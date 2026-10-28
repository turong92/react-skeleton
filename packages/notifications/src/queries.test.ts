import { describe, expect, it } from 'vitest'
import type { NotificationsApi } from './notificationsApi'
import {
  notificationKeys,
  notificationListQuery,
  preferencesQuery,
  unreadCountQuery,
} from './queries'

function fakeApi() {
  const calls: unknown[] = []
  const api: NotificationsApi = {
    list: async (params) => {
      calls.push(params)
      return {
        values: [],
        pagination: {
          page: 0,
          size: 1,
          totalElements: 7,
          totalPages: 7,
          hasNext: true,
          hasPrevious: false,
        },
        meta: { timestamp: 't' },
      }
    },
    markRead: async () => ({ eventId: 'e', readAt: 't' }),
    markAllRead: async () => ({ updated: 0 }),
    unreadCount: async () => {
      calls.push('unreadCount')
      return { count: 7 }
    },
    preferences: async () => ({ items: [{ type: 'a', muted: false }] }),
    setPreference: async (type, muted) => ({ type, muted }),
  }
  return { api, calls }
}

describe('query definitions', () => {
  it('keys nest: all ⊃ lists ⊃ one list, and the unread count has its own key', () => {
    expect(notificationKeys.all).toEqual(['notifications'])
    expect(notificationKeys.lists()).toEqual(['notifications', 'list'])
    expect(notificationKeys.list({ page: 1 })).toEqual(['notifications', 'list', { page: 1 }])
    expect(notificationKeys.list()).toEqual(['notifications', 'list', {}])
    expect(notificationKeys.unread()).toEqual(['notifications', 'unread'])
    expect(notificationKeys.preferences()).toEqual(['notifications', 'preferences'])
  })

  it('a list query asks the api for exactly its params', async () => {
    const { api, calls } = fakeApi()
    const query = notificationListQuery(api, { page: 1, size: 5 })
    expect(query.queryKey).toEqual(['notifications', 'list', { page: 1, size: 5 }])
    await query.queryFn()
    expect(calls).toEqual([{ page: 1, size: 5 }])
  })

  it('the unread count comes from the dedicated endpoint, not from a size-1 list', async () => {
    const { api, calls } = fakeApi()
    const query = unreadCountQuery(api)
    expect(query.queryKey).toEqual(['notifications', 'unread'])
    await expect(query.queryFn()).resolves.toBe(7)
    expect(calls).toEqual(['unreadCount'])
  })

  it('the preferences query asks the api for the list under its own key', async () => {
    const { api } = fakeApi()
    const query = preferencesQuery(api)
    expect(query.queryKey).toEqual(['notifications', 'preferences'])
    await expect(query.queryFn()).resolves.toEqual({ items: [{ type: 'a', muted: false }] })
  })
})
