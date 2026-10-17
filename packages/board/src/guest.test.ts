import type { ApiPageResponse, ApiRequest } from '@skeleton/api-client'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { createBoardApi } from './boardApi'
import { createCommentMutation } from './mutations'
import { boardKeys } from './queries'
import { comment, detail, stubApi } from './test/fixtures'

type Call = { path: string; request?: ApiRequest }

function recorder() {
  const calls: Call[] = []
  const record = async (path: string, request?: ApiRequest) => {
    calls.push({ path, request })
    return {}
  }
  return {
    calls,
    client: {
      page: record as <T>(path: string, request?: ApiRequest) => Promise<ApiPageResponse<T>>,
      value: record as <T>(path: string, request?: ApiRequest) => Promise<T>,
      list: record as <T>(path: string, request?: ApiRequest) => Promise<T[]>,
      noContent: record as unknown as (path: string, request?: ApiRequest) => Promise<void>,
    },
  }
}

describe('guest calls — the secret travels in a header only', () => {
  it('createPost with guest: name + captcha token in the body, secret only in X-Board-Guest-Secret', async () => {
    const { client, calls } = recorder()
    await createBoardApi(client).createPost('free', {
      title: 'Hi',
      body: 'There',
      guest: { name: 'Visitor', secret: 'pw-1234', captchaToken: 'tok' },
    })
    expect(calls[0].request?.json).toEqual({
      title: 'Hi',
      body: 'There',
      guestName: 'Visitor',
      captchaToken: 'tok',
    })
    expect(JSON.stringify(calls[0].request?.json)).not.toContain('pw-1234')
    expect(calls[0].request?.headers).toEqual({ 'X-Board-Guest-Secret': 'pw-1234' })
  })

  it('a member write carries no secret header and no guest keys', async () => {
    const { client, calls } = recorder()
    await createBoardApi(client).createComment('free', 3, { body: 'hi' })
    expect(calls[0].request?.json).toEqual({ body: 'hi' })
    expect(calls[0].request?.headers).toBeUndefined()
  })

  it('edit, delete, approve and decide send the secret as a header when one is given', async () => {
    const { client, calls } = recorder()
    const api = createBoardApi(client)
    const guest = { guestSecret: 's3cret' }
    await api.updatePost('free', 1, { title: 'x' }, guest)
    await api.removePost('free', 1, guest)
    await api.updateComment('free', 1, 2, { attachments: ['k/1.png'] }, guest)
    await api.removeComment('free', 1, 2, guest)
    await api.moderateComment('free', 1, 2, { status: 'PUBLISHED' }, guest)
    await api.decideCommentRevision('free', 1, 2, 'APPROVE', '2026-10-17T00:00:00.000001Z', guest)
    expect(calls.map((c) => c.request?.headers)).toEqual(
      Array(6).fill({ 'X-Board-Guest-Secret': 's3cret' }),
    )
    expect(calls[2].request?.json).toEqual({ attachments: ['k/1.png'] })
    expect(calls[5]).toMatchObject({
      path: '/boards/free/posts/1/comments/2/revision',
      request: {
        method: 'PUT',
        json: { decision: 'APPROVE', submittedAt: '2026-10-17T00:00:00.000001Z' },
      },
    })
  })

  it('queues and board settings use the documented paths and filters', async () => {
    const { client, calls } = recorder()
    const api = createBoardApi(client)
    await api.listPendingComments('free', 1, { page: 1 }, { guestSecret: 's' })
    await api.listCommentRevisions('free', 1)
    await api.listPosts('free', { revision: 'pending' })
    await api.decidePostRevision('free', 1, 'REJECT', '2026-10-17T00:00:00.000001Z')
    await api.updateBoard('free', { settings: { postApproval: 'ALL' } })
    expect(calls[0].request?.params).toEqual({ page: 1, status: 'PENDING' })
    expect(calls[0].request?.headers).toEqual({ 'X-Board-Guest-Secret': 's' })
    expect(calls[1].request?.params).toEqual({ revision: 'pending' })
    expect(calls[2].request?.params).toEqual({ revision: 'pending' })
    expect(calls[3]).toMatchObject({
      path: '/boards/free/posts/1/revision',
      request: {
        method: 'PUT',
        json: { decision: 'REJECT', submittedAt: '2026-10-17T00:00:00.000001Z' },
      },
    })
    expect(calls[4]).toMatchObject({ path: '/boards/free', request: { method: 'PATCH' } })
  })
})

describe('createComment mutation — a waiting comment is not counted', () => {
  it('PENDING leaves commentCount alone, PUBLISHED adds one', async () => {
    const client = new QueryClient()
    client.setQueryData(boardKeys.post('free', 1), detail(1))
    const make = (status: 'PENDING' | 'PUBLISHED') =>
      new MutationObserver(
        client,
        createCommentMutation(
          client,
          stubApi({ createComment: async () => comment(5, null, { status }) }),
          'free',
          1,
        ),
      )
    await make('PENDING').mutate({ input: { body: 'x' } })
    expect(
      client.getQueryData<{ commentCount: number }>(boardKeys.post('free', 1))?.commentCount,
    ).toBe(0)
    await make('PUBLISHED').mutate({ input: { body: 'x' } })
    expect(
      client.getQueryData<{ commentCount: number }>(boardKeys.post('free', 1))?.commentCount,
    ).toBe(1)
  })

  it('signed access names the picture by position, the list it is in, and the one secret a signed-out caller proves', async () => {
    const { client, calls } = recorder()
    const api = createBoardApi(client)
    await api.postAttachmentAccess('free', 1, 0)
    await api.commentAttachmentAccess('free', 1, 2, 1, {
      from: 'edit',
      as: 'owner',
      guestSecret: 's',
    })
    expect(calls[0]).toMatchObject({
      path: '/boards/free/posts/1/attachments',
      request: { params: { index: 0 } },
    })
    expect(calls[1].request?.params).toEqual({ index: 1, from: 'edit', as: 'owner' })
    expect(calls[1].request?.headers).toEqual({ 'X-Board-Guest-Secret': 's' })
  })
})
