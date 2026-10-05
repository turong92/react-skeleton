import type { ApiPageResponse, ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createBoardApi } from './boardApi'

type Call = { kind: 'page' | 'value' | 'list' | 'noContent'; path: string; request?: ApiRequest }

/** 경로 · 메서드 · 본문 · 헤더만 재는 가짜 클라이언트 — 응답은 호출하는 쪽이 정한다 */
function fakeClient(answer: unknown = {}) {
  const calls: Call[] = []
  const record = (kind: Call['kind']) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return answer
  }
  return {
    calls,
    client: {
      page: record('page') as <T>(
        path: string,
        request?: ApiRequest,
      ) => Promise<ApiPageResponse<T>>,
      value: record('value') as <T>(path: string, request?: ApiRequest) => Promise<T>,
      list: record('list') as <T>(path: string, request?: ApiRequest) => Promise<T[]>,
      noContent: record('noContent') as (path: string, request?: ApiRequest) => Promise<void>,
    },
  }
}

describe('createBoardApi (kotlin-skeleton modules/board — see packages/board/README.md)', () => {
  it('getConfig → GET /boards/config', async () => {
    const { client, calls } = fakeClient()
    await createBoardApi(client).getConfig()
    expect(calls).toEqual([{ kind: 'value', path: '/boards/config', request: undefined }])
  })

  it('listBoards → GET /boards as a list; getBoard → GET /boards/{code}', async () => {
    const { client, calls } = fakeClient()
    const api = createBoardApi(client)
    await api.listBoards()
    await api.getBoard('free talk')
    expect(calls.map((c) => [c.kind, c.path])).toEqual([
      ['list', '/boards'],
      ['value', '/boards/free%20talk'],
    ])
  })

  it('createBoard → POST /boards with a fresh Idempotency-Key', async () => {
    const { client, calls } = fakeClient()
    await createBoardApi(client).createBoard({ code: 'news', name: 'News' })
    expect(calls[0]).toMatchObject({ kind: 'value', path: '/boards' })
    expect(calls[0].request).toMatchObject({ method: 'POST', json: { code: 'news', name: 'News' } })
    expect(calls[0].request?.idempotencyKey).toMatch(/^fe-/)
  })

  it('listPosts → GET /boards/{code}/posts as a page; sends only the conditions that have a value', async () => {
    const { client, calls } = fakeClient()
    const api = createBoardApi(client)
    await api.listPosts('free', {
      page: 2,
      size: 10,
      sort: 'reactions',
      q: '공지',
      reaction: 'EMPATHY',
    })
    await api.listPosts('free', { q: '', sort: undefined })
    await api.listPosts('free')
    await api.listPosts('free', { mine: true })
    expect(calls[0]).toEqual({
      kind: 'page',
      path: '/boards/free/posts',
      request: { params: { page: 2, size: 10, sort: 'reactions', q: '공지', reaction: 'EMPATHY' } },
    })
    expect(calls[1].request).toEqual({ params: {} })
    expect(calls[2].request).toEqual({ params: {} })
    expect(calls[3].request).toEqual({ params: { mine: true } }) // 내 글만(백엔드 `mine`)
  })

  it('getPost → GET /boards/{code}/posts/{id}', async () => {
    const { client, calls } = fakeClient()
    await createBoardApi(client).getPost('free', 1)
    expect(calls[0]).toMatchObject({ kind: 'value', path: '/boards/free/posts/1' })
  })

  it('createPost → POST with an Idempotency-Key; a caller-given key is kept for a retry', async () => {
    const { client, calls } = fakeClient()
    const api = createBoardApi(client)
    await api.createPost('free', { title: 'Hi', body: 'There' })
    await api.createPost('free', { title: 'Hi', body: 'There' }, { idempotencyKey: 'retry-1' })
    expect(calls[0].request).toMatchObject({ method: 'POST', json: { title: 'Hi', body: 'There' } })
    expect(calls[0].request?.idempotencyKey).toMatch(/^fe-/)
    expect(calls[1].request?.idempotencyKey).toBe('retry-1')
  })

  it('updatePost → PATCH, removePost → DELETE as 204, moderatePost → PUT …/moderation', async () => {
    const { client, calls } = fakeClient()
    const api = createBoardApi(client)
    await api.updatePost('free', 1, { title: 'New' })
    await api.removePost('free', 1)
    await api.moderatePost('free', 1, { pinned: true })
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/boards/free/posts/1',
        request: { method: 'PATCH', json: { title: 'New' } },
      },
      { kind: 'noContent', path: '/boards/free/posts/1', request: { method: 'DELETE' } },
      {
        kind: 'value',
        path: '/boards/free/posts/1/moderation',
        request: { method: 'PUT', json: { pinned: true } },
      },
    ])
  })

  it('listComments → GET …/comments as a page with the sort', async () => {
    const { client, calls } = fakeClient()
    await createBoardApi(client).listComments('free', 1, { page: 1, sort: 'latest' })
    expect(calls[0]).toEqual({
      kind: 'page',
      path: '/boards/free/posts/1/comments',
      request: { params: { page: 1, sort: 'latest' } },
    })
  })

  it('createComment → POST with parentId and an Idempotency-Key', async () => {
    const { client, calls } = fakeClient()
    await createBoardApi(client).createComment('free', 1, { body: 'Reply', parentId: 1 })
    expect(calls[0]).toMatchObject({ kind: 'value', path: '/boards/free/posts/1/comments' })
    expect(calls[0].request).toMatchObject({ method: 'POST', json: { body: 'Reply', parentId: 1 } })
    expect(calls[0].request?.idempotencyKey).toMatch(/^fe-/)
  })

  it('updateComment → PATCH, removeComment → DELETE as 204, moderateComment → PUT …/moderation', async () => {
    const { client, calls } = fakeClient()
    const api = createBoardApi(client)
    await api.updateComment('free', 1, 1, { body: 'Edited' })
    await api.removeComment('free', 1, 1)
    await api.moderateComment('free', 1, 1, { status: 'HIDDEN' })
    expect(calls.map((c) => [c.kind, c.path, c.request?.method])).toEqual([
      ['value', '/boards/free/posts/1/comments/1', 'PATCH'],
      ['noContent', '/boards/free/posts/1/comments/1', 'DELETE'],
      ['value', '/boards/free/posts/1/comments/1/moderation', 'PUT'],
    ])
    expect(calls[2].request?.json).toEqual({ status: 'HIDDEN' })
  })

  it('putReaction → PUT …/reactions with the type, for a post and for a comment', async () => {
    const { client, calls } = fakeClient()
    const api = createBoardApi(client)
    await api.putReaction('free', { kind: 'post', postId: 1 }, 'EMPATHY')
    await api.putReaction('free', { kind: 'comment', postId: 1, commentId: 1 }, 'LIKE')
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/boards/free/posts/1/reactions',
        request: { method: 'PUT', json: { type: 'EMPATHY' } },
      },
      {
        kind: 'value',
        path: '/boards/free/posts/1/comments/1/reactions',
        request: { method: 'PUT', json: { type: 'LIKE' } },
      },
    ])
  })

  it('removeReaction → DELETE …/reactions?type= ; the type is optional (SINGLE removes whichever is mine)', async () => {
    const { client, calls } = fakeClient()
    const api = createBoardApi(client)
    await api.removeReaction('free', { kind: 'post', postId: 1 }, 'LIKE')
    await api.removeReaction('free', { kind: 'comment', postId: 1, commentId: 1 })
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/boards/free/posts/1/reactions',
        request: { method: 'DELETE', params: { type: 'LIKE' } },
      },
      {
        kind: 'value',
        path: '/boards/free/posts/1/comments/1/reactions',
        request: { method: 'DELETE', params: {} },
      },
    ])
  })

  it('basePath moves every endpoint (a trailing slash is ignored)', async () => {
    const { client, calls } = fakeClient()
    const api = createBoardApi(client, { basePath: '/forum/' })
    await api.getConfig()
    await api.listPosts('free')
    expect(calls.map((c) => c.path)).toEqual(['/forum/config', '/forum/free/posts'])
  })
})
