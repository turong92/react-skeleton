import type { ApiPageResponse, ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createNotificationsApi } from './notificationsApi'
import type { NotificationItem } from './types'

type Call = { kind: 'page' | 'value'; path: string; request?: ApiRequest }

const item: NotificationItem = {
  id: 'u1:e1',
  eventId: 'e1',
  recipientId: 'u1',
  topic: 'demo',
  type: 'order.paid',
  severity: 'SUCCESS',
  title: 'Paid',
  message: null,
  payload: {},
  createdAt: '2026-06-12T00:00:00Z',
  readAt: null,
}
const meta = { timestamp: 't' }

function fakeClient() {
  const calls: Call[] = []
  const pageBody: ApiPageResponse<NotificationItem> = {
    values: [item],
    pagination: {
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
    meta,
  }
  return {
    calls,
    client: {
      page: async <T>(path: string, request?: ApiRequest) => {
        calls.push({ kind: 'page', path, request })
        return pageBody as unknown as ApiPageResponse<T>
      },
      value: async <T>(path: string, request?: ApiRequest) => {
        calls.push({ kind: 'value', path, request })
        return { eventId: 'e1', readAt: '2026-06-12T01:00:00Z', updated: 3 } as unknown as T
      },
    },
  }
}

describe('createNotificationsApi (kotlin-skeleton apps/workbench NotificationInboxController)', () => {
  it('list → GET /notifications as a page envelope with the page query (page, size, unreadOnly, topic)', async () => {
    const { client, calls } = fakeClient()
    const api = createNotificationsApi(client)
    const result = await api.list({ page: 2, size: 10, unreadOnly: true, topic: 'demo' })
    expect(result.values).toEqual([item])
    expect(result.pagination.totalElements).toBe(1)
    expect(calls).toEqual([
      {
        kind: 'page',
        path: '/notifications',
        request: { params: { page: 2, size: 10, unreadOnly: true, topic: 'demo' } },
      },
    ])
  })

  it('list without params sends no query', async () => {
    const { client, calls } = fakeClient()
    await createNotificationsApi(client).list()
    expect(calls[0].request?.params).toEqual({})
  })

  it('markRead → PATCH /notifications/{eventId}/read (the id is path-encoded)', async () => {
    const { client, calls } = fakeClient()
    const result = await createNotificationsApi(client).markRead('a/b c')
    expect(result).toMatchObject({ eventId: 'e1', readAt: '2026-06-12T01:00:00Z' })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/notifications/a%2Fb%20c/read',
      request: { method: 'PATCH' },
    })
  })

  it('markAllRead → PATCH /notifications/read-all', async () => {
    const { client, calls } = fakeClient()
    const result = await createNotificationsApi(client).markAllRead()
    expect(result.updated).toBe(3)
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/notifications/read-all',
      request: { method: 'PATCH' },
    })
  })

  it('the base path is configurable because the inbox controller belongs to the app, not to a module', async () => {
    const { client, calls } = fakeClient()
    const api = createNotificationsApi(client, { basePath: '/me/inbox/' })
    await api.list()
    await api.markAllRead()
    expect(calls.map((c) => c.path)).toEqual(['/me/inbox', '/me/inbox/read-all'])
  })
})
