import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import {
  createCommentMutation,
  createPostMutation,
  removeCommentMutation,
  removePostMutation,
  updatePostMutation,
} from './mutations'
import { boardKeys } from './queries'
import { comment, detail, page, stubApi, summary } from './test/fixtures'
import type { PostDetail } from './types'

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
const invalidated = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([filter]) => (filter as { queryKey: unknown }).queryKey)

describe('post mutations — what each one refreshes', () => {
  it('createPost: the new post is cached as a detail, the lists and the board counts are refetched', async () => {
    const client = newClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const createPost = vi.fn(async () => detail(9))
    const observer = new MutationObserver(
      client,
      createPostMutation(client, stubApi({ createPost }), 'free'),
    )
    await observer.mutate({ input: { title: 'Hi', body: 'There' }, idempotencyKey: 'k1' })

    expect(createPost).toHaveBeenCalledWith(
      'free',
      { title: 'Hi', body: 'There' },
      { idempotencyKey: 'k1' },
    )
    expect(client.getQueryData(boardKeys.post('free', 9))).toEqual(detail(9))
    expect(invalidated(spy)).toEqual([boardKeys.postLists('free'), boardKeys.boards()])
  })

  it('updatePost: the returned detail replaces the cache (no refetch of the detail — that would count a view)', async () => {
    const client = newClient()
    client.setQueryData(boardKeys.post('free', 1), detail(1))
    const spy = vi.spyOn(client, 'invalidateQueries')
    const observer = new MutationObserver(
      client,
      updatePostMutation(
        client,
        stubApi({ updatePost: async () => detail(1, { title: 'Edited' }) }),
        'free',
        1,
      ),
    )
    await observer.mutate({ title: 'Edited' })
    expect(client.getQueryData<PostDetail>(boardKeys.post('free', 1))?.title).toBe('Edited')
    expect(invalidated(spy)).toEqual([boardKeys.postLists('free')])
  })

  it('removePost: the detail is dropped, lists and board counts are refetched', async () => {
    const client = newClient()
    client.setQueryData(boardKeys.post('free', 1), detail(1))
    const spy = vi.spyOn(client, 'invalidateQueries')
    const observer = new MutationObserver(
      client,
      removePostMutation(client, stubApi({ removePost: async () => undefined }), 'free'),
    )
    await observer.mutate(1)
    expect(client.getQueryData(boardKeys.post('free', 1))).toBeUndefined()
    expect(invalidated(spy)).toEqual([boardKeys.postLists('free'), boardKeys.boards()])
  })
})

describe('comment mutations', () => {
  it('createComment: the thread list is refetched and the post comment counts go up by one', async () => {
    const client = newClient()
    client.setQueryData(boardKeys.post('free', 1), detail(1, { commentCount: 2 }))
    client.setQueryData(
      boardKeys.postList('free', {}),
      page([summary(1, { commentCount: 2 }), summary(2, { commentCount: 5 })]),
    )
    const spy = vi.spyOn(client, 'invalidateQueries')
    const createComment = vi.fn(async () => comment(9))
    const observer = new MutationObserver(
      client,
      createCommentMutation(client, stubApi({ createComment }), 'free', 1),
    )
    await observer.mutate({ input: { body: 'Hi', parentId: 1 }, idempotencyKey: 'k2' })

    expect(createComment).toHaveBeenCalledWith(
      'free',
      1,
      { body: 'Hi', parentId: 1 },
      { idempotencyKey: 'k2' },
    )
    expect(client.getQueryData<PostDetail>(boardKeys.post('free', 1))?.commentCount).toBe(3)
    const list = client.getQueryData<ReturnType<typeof page<ReturnType<typeof summary>>>>(
      boardKeys.postList('free', {}),
    )!
    expect(list.values.map((p) => p.commentCount)).toEqual([3, 5])
    expect(invalidated(spy)).toEqual([boardKeys.comments('free', 1)])
  })

  it('removeComment: the thread list is refetched (the placeholder arrives from the server)', async () => {
    const client = newClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const observer = new MutationObserver(
      client,
      removeCommentMutation(client, stubApi({ removeComment: async () => undefined }), 'free', 1),
    )
    await observer.mutate(1)
    expect(invalidated(spy)).toEqual([boardKeys.comments('free', 1)])
  })
})
