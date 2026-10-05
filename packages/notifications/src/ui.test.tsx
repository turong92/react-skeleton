import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { badgeText } from './badge'
import { NotificationBell } from './NotificationBell'
import { NotificationList } from './NotificationList'
import type { NotificationsApi } from './notificationsApi'
import { notificationKeys } from './queries'
import type { NotificationItem } from './types'

const make = (over: Partial<NotificationItem>): NotificationItem => ({
  id: 'u1:e1',
  eventId: 'e1',
  recipientId: 'u1',
  topic: 'demo',
  type: 'order.paid',
  severity: 'INFO',
  title: 'Order paid',
  message: 'Thanks',
  payload: {},
  createdAt: '2026-06-12T00:00:00Z',
  readAt: null,
  ...over,
})

describe('NotificationList', () => {
  it('shows title, message and the formatted time; unread rows are marked', () => {
    const html = renderToStaticMarkup(
      <NotificationList
        items={[
          make({}),
          make({ id: 'u1:e2', eventId: 'e2', title: 'Old', readAt: '2026-06-12T01:00:00Z' }),
        ]}
        formatTime={(iso) => `at ${iso}`}
      />,
    )
    expect(html).toContain('Order paid')
    expect(html).toContain('Thanks')
    expect(html).toContain('at 2026-06-12T00:00:00Z')
    expect(html.match(/data-unread="true"/g)).toHaveLength(1)
    expect(html).toMatch(/^<ul/)
  })

  it('falls back to the type when the notification has no title', () => {
    const html = renderToStaticMarkup(
      <NotificationList items={[make({ title: null, message: null })]} />,
    )
    expect(html).toContain('order.paid')
  })

  it('the mark-read button exists only for unread items, named by a prop with an English default', () => {
    const items = [make({}), make({ id: 'u1:e2', eventId: 'e2', readAt: 't' })]
    const html = renderToStaticMarkup(<NotificationList items={items} onRead={() => {}} />)
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('Mark as read')
    expect(
      renderToStaticMarkup(
        <NotificationList items={items} onRead={() => {}} markReadLabel="읽음" />,
      ),
    ).toContain('읽음')
    expect(renderToStaticMarkup(<NotificationList items={items} />)).not.toContain('<button')
  })

  it('shows the empty state text when there is nothing', () => {
    const html = renderToStaticMarkup(<NotificationList items={[]} emptyTitle="Nothing new" />)
    expect(html).toContain('Nothing new')
    expect(html).not.toContain('<ul')
  })

  it('exposes severity as a data attribute for styling and says it in words for screen readers', () => {
    const html = renderToStaticMarkup(
      <NotificationList
        items={[make({ severity: 'ERROR' })]}
        severityLabels={{ ERROR: 'Error' }}
      />,
    )
    expect(html).toContain('data-severity="ERROR"')
    expect(html).toContain('Error')
  })
})

describe('NotificationBell', () => {
  const api: NotificationsApi = {
    list: async () => {
      throw new Error('no network in tests')
    },
    markRead: async () => ({ eventId: 'e', readAt: 't' }),
    markAllRead: async () => ({ updated: 0 }),
  }
  const render = (unread?: number, props: Partial<Parameters<typeof NotificationBell>[0]> = {}) => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    })
    if (unread !== undefined) client.setQueryData(notificationKeys.unread(), unread)
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <NotificationBell api={api} {...props} />
      </QueryClientProvider>,
    )
  }

  it('is a button whose accessible name carries the unread count, with a visible badge', () => {
    const html = render(3)
    expect(html).toMatch(/<button[^>]*aria-label="Notifications, 3 unread"/)
    expect(html).toContain('>3<')
  })

  it('has no badge and a plain name when everything is read', () => {
    const html = render(0)
    expect(html).toMatch(/<button[^>]*aria-label="Notifications"/)
    expect(html).not.toContain('data-badge')
  })

  it('the bell label is a prop so a Korean app can say it its own way', () => {
    const html = render(2, { bellLabel: (n) => `알림 ${n}개 안 읽음` })
    expect(html).toContain('aria-label="알림 2개 안 읽음"')
  })

  it('opens a dialog (native, focus-trapped) that starts closed', () => {
    const html = render(1)
    expect(html).toContain('<dialog')
    expect(html).not.toContain(' open=""')
  })
})

describe('badgeText', () => {
  it('caps at 99+ and hides zero', () => {
    expect(badgeText(0)).toBeNull()
    expect(badgeText(7)).toBe('7')
    expect(badgeText(99)).toBe('99')
    expect(badgeText(100)).toBe('99+')
    expect(badgeText(250, 9)).toBe('9+')
  })
})
