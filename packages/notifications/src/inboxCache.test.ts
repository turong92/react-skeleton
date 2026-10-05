import type { ApiPageResponse } from '@skeleton/api-client'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { applyRead, applyReadAll, createInboxSync, parseNotificationEvent } from './inboxCache'
import { notificationKeys } from './queries'
import type { NotificationItem } from './types'

const item = (eventId: string, readAt: string | null = null): NotificationItem => ({
  id: `u1:${eventId}`,
  eventId,
  recipientId: 'u1',
  topic: 'demo',
  type: 'order.paid',
  severity: 'INFO',
  title: eventId,
  message: null,
  payload: {},
  createdAt: '2026-06-12T00:00:00Z',
  readAt,
})
const page = (...values: NotificationItem[]): ApiPageResponse<NotificationItem> => ({
  values,
  pagination: {
    page: 0,
    size: 20,
    totalElements: values.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  },
  meta: { timestamp: 't' },
})
// gcTime: Infinity — 테스트가 타이머를 남기지 않게
const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })

describe('applyRead', () => {
  it('stamps readAt on that item in every cached list and decrements the unread count once', () => {
    const client = newClient()
    client.setQueryData(notificationKeys.list({ page: 0 }), page(item('a'), item('b')))
    client.setQueryData(notificationKeys.list({ unreadOnly: true }), page(item('a')))
    client.setQueryData(notificationKeys.unread(), 5)

    applyRead(client, 'a', '2026-06-12T01:00:00Z')

    const all = client.getQueryData<ApiPageResponse<NotificationItem>>(
      notificationKeys.list({ page: 0 }),
    )!
    expect(all.values.map((v) => v.readAt)).toEqual(['2026-06-12T01:00:00Z', null])
    expect(client.getQueryData(notificationKeys.unread())).toBe(4)
  })

  it('marking an already-read item changes no count', () => {
    const client = newClient()
    client.setQueryData(notificationKeys.list({}), page(item('a', '2026-06-12T00:30:00Z')))
    client.setQueryData(notificationKeys.unread(), 2)
    applyRead(client, 'a', '2026-06-12T01:00:00Z')
    expect(client.getQueryData(notificationKeys.unread())).toBe(2)
    expect(
      client.getQueryData<ApiPageResponse<NotificationItem>>(notificationKeys.list({}))!.values[0]
        .readAt,
    ).toBe('2026-06-12T00:30:00Z')
  })

  it('the count never goes below zero, and an item that is in no cached list makes the count refetch', () => {
    const client = newClient()
    client.setQueryData(notificationKeys.list({}), page(item('a')))
    client.setQueryData(notificationKeys.unread(), 0)
    applyRead(client, 'a', 't')
    expect(client.getQueryData(notificationKeys.unread())).toBe(0)

    const other = newClient()
    other.setQueryData(notificationKeys.unread(), 3)
    applyRead(other, 'not-loaded', 't')
    expect(other.getQueryState(notificationKeys.unread())?.isInvalidated).toBe(true)
  })

  it('lists are invalidated so a server view (unreadOnly, paging) is refetched', () => {
    const client = newClient()
    client.setQueryData(notificationKeys.list({ unreadOnly: true }), page(item('a')))
    applyRead(client, 'a', 't')
    expect(client.getQueryState(notificationKeys.list({ unreadOnly: true }))?.isInvalidated).toBe(
      true,
    )
  })
})

describe('applyReadAll', () => {
  it('marks every cached unread item read and sets the unread count to 0', () => {
    const client = newClient()
    client.setQueryData(
      notificationKeys.list({}),
      page(item('a'), item('b', '2026-06-12T00:30:00Z')),
    )
    client.setQueryData(notificationKeys.unread(), 1)
    applyReadAll(client, '2026-06-12T02:00:00Z')
    const all = client.getQueryData<ApiPageResponse<NotificationItem>>(notificationKeys.list({}))!
    expect(all.values.map((v) => v.readAt)).toEqual([
      '2026-06-12T02:00:00Z',
      '2026-06-12T00:30:00Z',
    ])
    expect(client.getQueryData(notificationKeys.unread())).toBe(0)
  })
})

describe('parseNotificationEvent — what @skeleton/realtime hands over', () => {
  const event = {
    id: 'e9',
    topic: 'demo',
    type: 'order.paid',
    severity: 'SUCCESS',
    title: 'Paid',
    message: 'm',
    payload: { n: 1 },
    createdAt: '2026-06-12T00:00:00Z',
  }

  it('accepts a parsed object (SSE event.data / STOMP message.value) or a JSON string', () => {
    expect(parseNotificationEvent(event)).toMatchObject({
      id: 'e9',
      topic: 'demo',
      severity: 'SUCCESS',
    })
    expect(parseNotificationEvent(JSON.stringify(event))).toMatchObject({ id: 'e9' })
  })

  it('fills the optional parts and falls back to INFO for an unknown severity', () => {
    expect(parseNotificationEvent({ id: 'e', topic: 't', type: 'x', severity: 'LOUD' })).toEqual({
      id: 'e',
      topic: 't',
      type: 'x',
      severity: 'INFO',
      title: null,
      message: null,
      payload: {},
      createdAt: null,
    })
  })

  it('ignores anything that is not a notification: the SSE "connected" event, garbage, null', () => {
    expect(parseNotificationEvent({ topics: ['demo'], connectedAt: 't' })).toBeNull()
    expect(parseNotificationEvent('not json')).toBeNull()
    expect(parseNotificationEvent(null)).toBeNull()
    expect(parseNotificationEvent({ id: 'e', topic: 't' })).toBeNull()
  })
})

describe('createInboxSync.ingest', () => {
  const event = { id: 'e1', topic: 'demo', type: 'order.paid', severity: 'INFO' }

  it('bumps a cached unread count by one and invalidates the lists', () => {
    const client = newClient()
    client.setQueryData(notificationKeys.unread(), 2)
    client.setQueryData(notificationKeys.list({}), page(item('a')))
    const sync = createInboxSync(client)
    expect(sync.ingest(event)).toBe(true)
    expect(client.getQueryData(notificationKeys.unread())).toBe(3)
    expect(client.getQueryState(notificationKeys.list({}))?.isInvalidated).toBe(true)
  })

  it('the same event id counts once (reconnects replay events)', () => {
    const client = newClient()
    client.setQueryData(notificationKeys.unread(), 0)
    const sync = createInboxSync(client)
    expect(sync.ingest(event)).toBe(true)
    expect(sync.ingest(event)).toBe(false)
    expect(client.getQueryData(notificationKeys.unread())).toBe(1)
  })

  it('a non-notification payload does nothing', () => {
    const client = newClient()
    client.setQueryData(notificationKeys.unread(), 4)
    expect(createInboxSync(client).ingest({ topics: [] })).toBe(false)
    expect(client.getQueryData(notificationKeys.unread())).toBe(4)
  })

  it('with no count loaded yet nothing is bumped (the first fetch will include it)', () => {
    const client = newClient()
    createInboxSync(client).ingest(event)
    expect(client.getQueryData(notificationKeys.unread())).toBeUndefined()
  })

  it('calls onNotification so the app can toast or play a sound', () => {
    const seen: string[] = []
    const sync = createInboxSync(newClient(), { onNotification: (n) => seen.push(n.id) })
    sync.ingest(event)
    expect(seen).toEqual(['e1'])
  })
})
