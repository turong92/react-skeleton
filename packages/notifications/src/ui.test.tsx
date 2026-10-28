import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { badgeText } from './badge'
import { NotificationBell } from './NotificationBell'
import { NotificationList } from './NotificationList'
import { NotificationPreferences } from './NotificationPreferences'
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
  link: null,
  collapsedCount: 1,
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

describe('NotificationList — links, describe, collapsed rows', () => {
  const linked = make({ link: '/notes/7' })

  it('the title is an underlined-link <a href> only when onOpen is given and the link is an in-app path', () => {
    const html = renderToStaticMarkup(<NotificationList items={[linked]} onOpen={() => {}} />)
    expect(html).toMatch(/<a [^>]*href="\/notes\/7"[^>]*>Order paid<\/a>/)
    expect(renderToStaticMarkup(<NotificationList items={[linked]} />)).not.toContain('<a ')
  })

  it.each(['//evil.example/x', 'https://evil.example', '/\\evil.example'])(
    'never links %s even if the server sent it',
    (link) => {
      const html = renderToStaticMarkup(
        <NotificationList items={[make({ link })]} onOpen={() => {}} />,
      )
      expect(html).not.toContain('<a ')
    },
  )

  it('describe replaces the title and the message of a row', () => {
    const html = renderToStaticMarkup(
      <NotificationList
        items={[make({})]}
        describe={(item) => ({ title: `T:${item.type}`, message: 'M!' })}
      />,
    )
    expect(html).toContain('T:order.paid')
    expect(html).toContain('M!')
    expect(html).not.toContain('Thanks')
  })

  it('a collapsed row (count above 1) shows the count in a badge with a spoken label', () => {
    const html = renderToStaticMarkup(
      <NotificationList
        items={[make({ collapsedCount: 3 }), make({ id: 'u1:e2', eventId: 'e2' })]}
        collapsedLabel={(n) => `${n} times`}
      />,
    )
    expect(html).toContain('3 times')
    expect(html.match(/data-tone=/g)).toHaveLength(1)
  })
})

describe('NotificationPreferences', () => {
  it('shows a spinner while the list loads and no switch yet', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <NotificationPreferences
          api={{
            list: async () => {
              throw new Error('unused')
            },
            markRead: async () => ({ eventId: 'e', readAt: 't' }),
            markAllRead: async () => ({ updated: 0 }),
            unreadCount: async () => ({ count: 0 }),
            preferences: async () => ({ items: [] }),
            setPreference: async (type, muted) => ({ type, muted }),
          }}
          loadingLabel="Loading"
        />
      </QueryClientProvider>,
    )
    expect(html).toContain('Loading')
    expect(html).not.toContain('role="switch"')
  })

  it('draws one switch per type, on unless muted, named by labels[type] or the type itself', () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    client.setQueryData(notificationKeys.preferences(), {
      items: [
        { type: 'NOTE_UPDATED', muted: false },
        { type: 'comment.created', muted: true },
      ],
    })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <NotificationPreferences
          api={{} as NotificationsApi}
          labels={{ NOTE_UPDATED: 'Note edits' }}
        />
      </QueryClientProvider>,
    )
    expect(html).toContain('Note edits')
    expect(html).toContain('comment.created')
    expect(html.match(/role="switch"/g)).toHaveLength(2)
    expect(html.match(/checked=""/g)).toHaveLength(1)
  })

  it('shows an empty state when the server lists no type', () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    client.setQueryData(notificationKeys.preferences(), { items: [] })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <NotificationPreferences api={{} as NotificationsApi} emptyTitle="Nothing to mute" />
      </QueryClientProvider>,
    )
    expect(html).toContain('Nothing to mute')
  })
})

describe('NotificationBell', () => {
  const api: NotificationsApi = {
    list: async () => {
      throw new Error('no network in tests')
    },
    markRead: async () => ({ eventId: 'e', readAt: 't' }),
    markAllRead: async () => ({ updated: 0 }),
    unreadCount: async () => ({ count: 0 }),
    preferences: async () => ({ items: [] }),
    setPreference: async (type, muted) => ({ type, muted }),
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
