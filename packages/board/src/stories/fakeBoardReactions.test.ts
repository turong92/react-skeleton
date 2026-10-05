import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createFakeBoard } from './fakeBoard'

/** 가짜 서버가 계약(packages/board/README.md · 백엔드 modules/board)의 규칙을 지키는지 — 스토리의 근거가 거짓이면 안 된다 */
const rejects = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )

describe('fake board — reactions are typed codes the server reports', () => {
  it('config reports the types and the mode; an unknown type is BOARD.REACTION_TYPE_INVALID', async () => {
    const { api } = createFakeBoard({ seed: false, types: ['LIKE', 'DISLIKE', 'EMPATHY'] })
    expect((await api.getConfig()).reactionTypes).toEqual(['LIKE', 'DISLIKE', 'EMPATHY'])
    const post = await api.createPost('free', { title: 't', body: 'b' })
    const error = await rejects(api.putReaction('free', { kind: 'post', postId: post.id }, 'LAUGH'))
    expect(isErrorCode(error, ErrorCodes.BOARD_REACTION_TYPE_INVALID)).toBe(true)
  })

  it('SINGLE: a second type replaces the first; the same type again changes nothing; DELETE without a type removes mine', async () => {
    const { api } = createFakeBoard({ seed: false, types: ['LIKE', 'EMPATHY'] })
    const post = await api.createPost('free', { title: 't', body: 'b' })
    const target = { kind: 'post', postId: post.id } as const
    expect(await api.putReaction('free', target, 'LIKE')).toEqual({
      counts: { LIKE: 1, EMPATHY: 0 },
      myReactions: ['LIKE'],
    })
    expect(await api.putReaction('free', target, 'LIKE')).toEqual({
      counts: { LIKE: 1, EMPATHY: 0 },
      myReactions: ['LIKE'],
    })
    expect(await api.putReaction('free', target, 'EMPATHY')).toEqual({
      counts: { LIKE: 0, EMPATHY: 1 },
      myReactions: ['EMPATHY'],
    })
    expect(await api.removeReaction('free', target)).toEqual({
      counts: { LIKE: 0, EMPATHY: 0 },
      myReactions: [],
    })
  })

  it('PER_TYPE: several types at once, removed one at a time; the post list carries the counts', async () => {
    const { api } = createFakeBoard({ seed: false, mode: 'PER_TYPE', types: ['LIKE', 'EMPATHY'] })
    const post = await api.createPost('free', { title: 't', body: 'b' })
    const target = { kind: 'post', postId: post.id } as const
    await api.putReaction('free', target, 'LIKE')
    await api.putReaction('free', target, 'EMPATHY')
    expect((await api.removeReaction('free', target, 'LIKE')).myReactions).toEqual(['EMPATHY'])
    const row = (await api.listPosts('free')).values[0]
    expect(row).toMatchObject({ reactionCounts: { LIKE: 0, EMPATHY: 1 }, myReactions: ['EMPATHY'] })
  })

  it('reacts to a comment the same way, and the comment list shows it', async () => {
    const { api } = createFakeBoard({ seed: false })
    const post = await api.createPost('free', { title: 't', body: 'b' })
    const c = await api.createComment('free', post.id, { body: 'x' })
    await api.putReaction('free', { kind: 'comment', postId: post.id, commentId: c.id }, 'LIKE')
    const [root] = (await api.listComments('free', post.id)).values
    expect(root).toMatchObject({ reactionCounts: { LIKE: 1, DISLIKE: 0 }, myReactions: ['LIKE'] })
  })
})
