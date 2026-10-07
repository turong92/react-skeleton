import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { ApiPageResponse } from '@skeleton/api-client'
import { boardKeys } from './queries'
import { reactionMutationOptions } from './reactionMutation'
import { comment, deferred, detail, page, stubApi, summary, thread, threads } from './test/fixtures'
import type { CommentWithReplies, PostDetail, PostSummary, ReactionState } from './types'

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })

const post = { kind: 'post', postId: 1 } as const
const onComment = (commentId: number) => ({ kind: 'comment', postId: 1, commentId }) as const

function seed(client: QueryClient) {
  client.setQueryData(
    boardKeys.post('free', 1),
    detail(1, { reactionCounts: { LIKE: 3 }, myReactions: ['LIKE'] }),
  )
  client.setQueryData(
    boardKeys.postList('free', { page: 0 }),
    page([summary(1, { reactionCounts: { LIKE: 3 }, myReactions: ['LIKE'] }), summary(2)]),
  )
  client.setQueryData(
    boardKeys.postList('free', { sort: 'reactions' }),
    page([summary(2), summary(1, { reactionCounts: { LIKE: 3 }, myReactions: ['LIKE'] })]),
  )
  client.setQueryData(
    boardKeys.commentList('free', 1, {}),
    threads(
      thread(1, [comment(2, 1, { reactionCounts: { LIKE: 1 } })], {
        reactionCounts: { LIKE: 2 },
      }),
      thread(3),
    ),
  )
}
const postDetail = (client: QueryClient) =>
  client.getQueryData<PostDetail>(boardKeys.post('free', 1))!
const lists = (client: QueryClient) => [
  client.getQueryData<ApiPageResponse<PostSummary>>(boardKeys.postList('free', { page: 0 }))!,
  client.getQueryData<ApiPageResponse<PostSummary>>(
    boardKeys.postList('free', { sort: 'reactions' }),
  )!,
]
const commentPage = (client: QueryClient) =>
  client.getQueryData<ApiPageResponse<CommentWithReplies>>(boardKeys.commentList('free', 1, {}))!

function run(client: QueryClient, api = stubApi(), mode: 'SINGLE' | 'PER_TYPE' = 'SINGLE') {
  const observer = new MutationObserver(client, reactionMutationOptions(client, api, 'free', mode))
  return (variables: {
    target: typeof post | ReturnType<typeof onComment>
    type: string
    active: boolean
  }) => observer.mutate(variables)
}

describe('reaction mutation — optimistic, with rollback', () => {
  it('shows the new reaction on the post detail and in every cached list page before the server answers', async () => {
    const client = newClient()
    seed(client)
    const answer = deferred<ReactionState>()
    const react = run(client, stubApi({ putReaction: () => answer.promise }))

    const done = react({ target: post, type: 'EMPATHY', active: true })
    await vi.waitFor(() => expect(postDetail(client).myReactions).toEqual(['EMPATHY']))

    expect(postDetail(client).reactionCounts).toEqual({ LIKE: 2, EMPATHY: 1 })
    for (const cached of lists(client)) {
      const row = cached.values.find((p) => p.id === 1)!
      expect(row.myReactions).toEqual(['EMPATHY'])
      expect(row.reactionCounts).toEqual({ LIKE: 2, EMPATHY: 1 })
    }
    expect(lists(client)[0].values.find((p) => p.id === 2)).toEqual(summary(2)) // 다른 글은 그대로
    answer.resolve({ counts: { LIKE: 2, EMPATHY: 1 }, myReactions: ['EMPATHY'] })
    await done
  })

  it('on an error, every cache goes back to exactly what it was', async () => {
    const client = newClient()
    seed(client)
    const before = JSON.stringify([postDetail(client), lists(client), commentPage(client)])
    const answer = deferred<ReactionState>()
    const react = run(client, stubApi({ putReaction: () => answer.promise }))

    const done = react({ target: post, type: 'EMPATHY', active: true }).catch(() => undefined)
    await vi.waitFor(() => expect(postDetail(client).myReactions).toEqual(['EMPATHY']))
    answer.reject(new Error('403'))
    await done

    expect(JSON.stringify([postDetail(client), lists(client), commentPage(client)])).toBe(before)
  })

  it('when the server answers, its counts win over the local guess', async () => {
    const client = newClient()
    seed(client)
    const react = run(
      client,
      stubApi({
        putReaction: async () => ({ counts: { LIKE: 9, EMPATHY: 4 }, myReactions: ['EMPATHY'] }),
      }),
    )
    await react({ target: post, type: 'EMPATHY', active: true })
    expect(postDetail(client).reactionCounts).toEqual({ LIKE: 9, EMPATHY: 4 })
    expect(lists(client)[1].values.find((p) => p.id === 1)!.reactionCounts).toEqual({
      LIKE: 9,
      EMPATHY: 4,
    })
  })

  it('a comment reaction changes that comment — a root or a reply — and nothing else', async () => {
    const client = newClient()
    seed(client)
    const answer = deferred<ReactionState>()
    const react = run(client, stubApi({ putReaction: () => answer.promise }))

    const done = react({ target: onComment(2), type: 'LIKE', active: true })
    await vi.waitFor(() =>
      expect(commentPage(client).values[0].replies[0].myReactions).toEqual(['LIKE']),
    )
    const [first, second] = commentPage(client).values
    expect(first.replies[0].reactionCounts).toEqual({ LIKE: 2 })
    expect(first.reactionCounts).toEqual({ LIKE: 2 }) // 최상위는 그대로
    expect(first.myReactions).toEqual([])
    expect(second).toEqual(thread(3))
    expect(postDetail(client).myReactions).toEqual(['LIKE']) // 글은 그대로
    answer.resolve({ counts: { LIKE: 2 }, myReactions: ['LIKE'] })
    await done
  })

  it('PER_TYPE keeps the first type when a second is added', async () => {
    const client = newClient()
    seed(client)
    const answer = deferred<ReactionState>()
    const react = run(client, stubApi({ putReaction: () => answer.promise }), 'PER_TYPE')
    const done = react({ target: post, type: 'EMPATHY', active: true })
    await vi.waitFor(() => expect(postDetail(client).myReactions).toEqual(['LIKE', 'EMPATHY']))
    expect(postDetail(client).reactionCounts).toEqual({ LIKE: 3, EMPATHY: 1 })
    answer.resolve({ counts: { LIKE: 3, EMPATHY: 1 }, myReactions: ['LIKE', 'EMPATHY'] })
    await done
  })

  it('un-pressing calls DELETE with the type and takes the reaction away at once', async () => {
    const client = newClient()
    seed(client)
    const answer = deferred<ReactionState>()
    const removeReaction = vi.fn(() => answer.promise)
    const react = run(client, stubApi({ removeReaction }))
    const done = react({ target: post, type: 'LIKE', active: false })
    await vi.waitFor(() => expect(postDetail(client).myReactions).toEqual([]))
    expect(postDetail(client).reactionCounts).toEqual({ LIKE: 2 })
    expect(removeReaction).toHaveBeenCalledWith('free', post, 'LIKE')
    answer.resolve({ counts: { LIKE: 2 }, myReactions: [] })
    await done
  })
})

describe('reaction mutation — overlapping presses and list freshness', () => {
  it('an earlier answer does not overwrite the newer optimistic state while a later press on the same target is in flight', async () => {
    const client = newClient()
    seed(client)
    const first = deferred<ReactionState>()
    const second = deferred<ReactionState>()
    const answers = [first, second]
    const react = run(
      client,
      stubApi({
        putReaction: () => answers.shift()!.promise,
        removeReaction: () => second.promise,
      }),
    )
    const one = react({ target: post, type: 'EMPATHY', active: true })
    await vi.waitFor(() => expect(postDetail(client).myReactions).toEqual(['EMPATHY']))
    const two = react({ target: post, type: 'EMPATHY', active: false }) // 바로 다시 눌러 뺀다
    await vi.waitFor(() => expect(postDetail(client).myReactions).toEqual([]))

    first.resolve({ counts: { LIKE: 2, EMPATHY: 1 }, myReactions: ['EMPATHY'] }) // 앞선 응답(이미 낡았다)
    await one
    expect(postDetail(client).myReactions).toEqual([]) // 뒤의 낙관 상태가 덮이지 않는다

    second.resolve({ counts: { LIKE: 2 }, myReactions: [] })
    await two
    expect(postDetail(client).reactionCounts).toEqual({ LIKE: 2 })
  })

  it('after a post reaction settles the cached lists are re-fetched (a list GET that raced the PUT may have kept a stale count) — the detail is not (it would bump the view count)', async () => {
    const client = newClient()
    seed(client)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const react = run(
      client,
      stubApi({
        putReaction: async () => ({ counts: { LIKE: 3, EMPATHY: 1 }, myReactions: ['EMPATHY'] }),
      }),
    )
    await react({ target: post, type: 'EMPATHY', active: true })
    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey))
    expect(keys).toContain(JSON.stringify(boardKeys.postLists('free')))
    expect(keys).not.toContain(JSON.stringify(boardKeys.post('free', 1)))
  })
})
