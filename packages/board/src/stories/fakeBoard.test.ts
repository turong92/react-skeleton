import { ApiRequestError, isErrorCode, ErrorCodes } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createFakeBoard } from './fakeBoard'

/** 가짜 서버가 계약(packages/board/README.md · 백엔드 modules/board)의 규칙을 지키는지 — 스토리의 근거가 거짓이면 안 된다 */
const rejects = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )

describe('fake board — posts', () => {
  it('lists pinned posts first on every sort, then the sort key', async () => {
    const { api } = createFakeBoard({ seed: false })
    const a = await api.createPost('free', { title: 'a', body: 'a' })
    const b = await api.createPost('free', { title: 'b', body: 'b' })
    const c = await api.createPost('free', { title: 'c', body: 'c' })
    await api.putReaction('free', { kind: 'post', postId: a.id }, 'LIKE')
    expect((await api.listPosts('free', { sort: 'latest' })).values.map((p) => p.title)).toEqual([
      'c',
      'b',
      'a',
    ])
    expect((await api.listPosts('free', { sort: 'reactions' })).values.map((p) => p.title)[0]).toBe(
      'a',
    )
    const mod = createFakeBoard({ seed: false, canModerate: true })
    const x = await mod.api.createPost('free', { title: 'x', body: 'x' })
    await mod.api.createPost('free', { title: 'y', body: 'y' })
    await mod.api.moderatePost('free', x.id, { pinned: true })
    expect((await mod.api.listPosts('free')).values.map((p) => p.title)).toEqual(['x', 'y'])
    expect([b.id, c.id].every(Boolean)).toBe(true)
  })

  it('searches title and body, and pages by size with totals', async () => {
    const { api } = createFakeBoard({ seed: false })
    for (const n of [1, 2, 3, 4, 5])
      await api.createPost('free', { title: `Post ${n}`, body: n === 4 ? 'needle' : 'hay' })
    const found = await api.listPosts('free', { q: 'needle' })
    expect(found.values.map((p) => p.title)).toEqual(['Post 4'])
    const second = await api.listPosts('free', { page: 1, size: 2 })
    expect(second.values).toHaveLength(2)
    expect(second.pagination).toMatchObject({
      page: 1,
      size: 2,
      totalElements: 5,
      totalPages: 3,
      hasNext: true,
    })
  })

  it('getPost counts a view; a hidden post is 404 for others but the owner and moderators can see it', async () => {
    const owner = createFakeBoard({ seed: false, canModerate: true })
    const post = await owner.api.createPost('free', { title: 't', body: 'b' })
    expect((await owner.api.getPost('free', post.id)).viewCount).toBe(1)
    expect((await owner.api.getPost('free', post.id)).viewCount).toBe(2)
    await owner.api.moderatePost('free', post.id, { status: 'HIDDEN' })
    expect((await owner.api.getPost('free', post.id)).status).toBe('HIDDEN')
    await owner.api.removePost('free', post.id)
    const error = await rejects(owner.api.getPost('free', 999))
    expect(isErrorCode(error, ErrorCodes.BOARD_POST_NOT_FOUND)).toBe(true)
  })

  it('moderation needs the moderator role', async () => {
    const { api } = createFakeBoard({ seed: false, canModerate: false })
    const post = await api.createPost('free', { title: 't', body: 'b' })
    const error = await rejects(api.moderatePost('free', post.id, { pinned: true }))
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(isErrorCode(error, ErrorCodes.BOARD_FORBIDDEN)).toBe(true)
  })

  it('rejects blank and too long content with BOARD.CONTENT_INVALID', async () => {
    const { api, config } = createFakeBoard({ seed: false })
    expect(
      isErrorCode(
        await rejects(api.createPost('free', { title: ' ', body: 'b' })),
        ErrorCodes.BOARD_CONTENT_INVALID,
      ),
    ).toBe(true)
    expect(
      isErrorCode(
        await rejects(
          api.createPost('free', { title: 'x'.repeat(config.titleMaxLength + 1), body: 'b' }),
        ),
        ErrorCodes.BOARD_CONTENT_INVALID,
      ),
    ).toBe(true)
  })
})

describe('fake board — comments are a tree', () => {
  async function withPost() {
    const board = createFakeBoard({ seed: false })
    const post = await board.api.createPost('free', { title: 't', body: 'b' })
    return { ...board, postId: post.id }
  }

  it('a reply gets the parent, root and depth; the list nests all descendants under their top-level comment, oldest first', async () => {
    const { api, postId } = await withPost()
    const c1 = await api.createComment('free', postId, { body: 'one' })
    const c2 = await api.createComment('free', postId, { body: 'reply', parentId: c1.id })
    const c3 = await api.createComment('free', postId, { body: 'reply of reply', parentId: c2.id })
    expect([c1, c2, c3].map((c) => c.depth)).toEqual([0, 1, 2])
    expect(c3).toMatchObject({ parentId: c2.id, rootId: c1.id })
    await api.createComment('free', postId, { body: 'two' })

    const { values } = await api.listComments('free', postId)
    expect(values.map((t) => t.body)).toEqual(['one', 'two'])
    expect(values[0].replies.map((r) => r.body)).toEqual(['reply', 'reply of reply'])
    expect(values[0].replyCount).toBe(2)
  })

  it('a reply deeper than maxCommentDepth is BOARD.COMMENT_TOO_DEEP', async () => {
    const { api, postId, config } = await withPost()
    let parent = await api.createComment('free', postId, { body: 'd0' })
    for (let depth = 1; depth <= config.maxCommentDepth; depth += 1)
      parent = await api.createComment('free', postId, { body: `d${depth}`, parentId: parent.id })
    const error = await rejects(
      api.createComment('free', postId, { body: 'too deep', parentId: parent.id }),
    )
    expect(isErrorCode(error, ErrorCodes.BOARD_COMMENT_TOO_DEEP)).toBe(true)
  })

  it('a deleted comment keeps its place with a null body; the post comment count follows creates', async () => {
    const { api, postId } = await withPost()
    const c1 = await api.createComment('free', postId, { body: 'one' })
    await api.createComment('free', postId, { body: 'reply', parentId: c1.id })
    await api.removeComment('free', postId, c1.id)
    const { values } = await api.listComments('free', postId)
    expect(values[0]).toMatchObject({ body: null, status: 'DELETED' })
    expect(values[0].replies).toHaveLength(1)
    expect((await api.getPost('free', postId)).commentCount).toBe(2)
  })

  it('only the owner edits; a moderator hides and restores', async () => {
    const mod = createFakeBoard({ seed: false, canModerate: true })
    const post = await mod.api.createPost('free', { title: 't', body: 'b' })
    const c = await mod.api.createComment('free', post.id, { body: 'x' })
    expect((await mod.api.updateComment('free', post.id, c.id, { body: 'edited' })).body).toBe(
      'edited',
    )
    expect(
      (await mod.api.moderateComment('free', post.id, c.id, { status: 'HIDDEN' })).body,
    ).toBeNull()
    expect(
      (await mod.api.moderateComment('free', post.id, c.id, { status: 'PUBLISHED' })).body,
    ).toBe('edited')
    const stranger = createFakeBoard({ seed: false })
    const error = await rejects(stranger.api.moderateComment('free', 1, 1, { status: 'HIDDEN' }))
    expect(isErrorCode(error, ErrorCodes.BOARD_FORBIDDEN)).toBe(true)
  })
})
