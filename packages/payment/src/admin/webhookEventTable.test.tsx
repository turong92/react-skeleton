import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { webhookEvent } from '../test/fixtures'
import { WebhookEventTable } from './WebhookEventTable'

const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 1. 1.' }
const noop = () => undefined
const html = (props: Partial<ComponentProps<typeof WebhookEventTable>>) =>
  renderToStaticMarkup(<WebhookEventTable {...common} events={[]} {...props} />)

const now = Date.parse('2026-01-01T12:00:00Z')
const minutesBefore = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

const rows = [
  webhookEvent({ id: 1, status: 'PROCESSED' }),
  webhookEvent({ id: 2, status: 'FAILED', lastError: 'LOOKUP_UNAVAILABLE', deliveries: 3 }),
  webhookEvent({ id: 3, status: 'DEAD', lastError: 'MODE_MISMATCH', orderId: null }),
  webhookEvent({ id: 4, status: 'IGNORED', resourceId: 'tgen_other', orderId: null }),
  webhookEvent({ id: 5, status: 'RECEIVED', orderId: 'ord_5', receivedAt: minutesBefore(2) }),
]

describe('WebhookEventTable', () => {
  it('is a table named 웹훅 수신함 showing when, which event, the provider payment number, the payment number, status in words and how many times it came', () => {
    const out = html({ events: rows, onRetryEvent: noop })
    expect(out).toContain('<table')
    expect(out).toContain('웹훅 수신함')
    for (const text of [
      '2026. 1. 1.',
      'PAYMENT_STATUS_CHANGED',
      'tgen_9f8e7d',
      'ord_1',
      '처리됨',
      '처리 안 됨',
      '처리 못 함',
      '건너뜀',
      '받음',
    ])
      expect(out, text).toContain(text)
    expect(out).not.toMatch(/>(PROCESSED|FAILED|DEAD|IGNORED|RECEIVED)</)
  })

  it('shows our reason code as a code, only where there is one', () => {
    const out = html({ events: rows, onRetryEvent: noop, now })
    expect(out).toContain('LOOKUP_UNAVAILABLE')
    expect(out).toContain('MODE_MISMATCH')
  })

  it('offers 다시 처리 only on the rows that need a hand (처리 안 됨 · 처리 못 함) — not on 받음 that just arrived, 건너뜀 or 처리됨 — and names it after the event', () => {
    const out = html({ events: rows, onRetryEvent: noop, now })
    const body = out.match(/<tbody>[\s\S]*<\/tbody>/)?.[0] ?? ''
    expect(body.match(/<button/g)).toHaveLength(2)
    expect(body.match(/data-variant="secondary"/g)).toHaveLength(2)
    // 같은 이벤트 이름이 여러 줄이니 줄을 가르는 값이 이름에 붙는다 — 결제 번호, 없으면 결제사 결제 번호
    const names = [...out.matchAll(/aria-label="(다시 처리[^"]*)"/g)].map((m) => m[1])
    expect(names).toEqual([
      '다시 처리: PAYMENT_STATUS_CHANGED (ord_1)',
      '다시 처리: PAYMENT_STATUS_CHANGED (tgen_9f8e7d)',
    ])
    expect(new Set(names).size).toBe(names.length)
    expect(html({ events: rows, now })).not.toContain('<button')
  })

  it('a healthy inbox is mostly 건너뜀: a page of them has no buttons, so the rows that need a hand are the only ones with one', () => {
    const ignored = Array.from({ length: 20 }, (_, i) =>
      webhookEvent({ id: 100 + i, status: 'IGNORED' }),
    )
    const out = html({
      events: [...ignored, webhookEvent({ id: 1, status: 'DEAD' })],
      onRetryEvent: noop,
      now,
    })
    expect(out.match(/<button/g)).toHaveLength(1)
  })

  it('a 받음 row that has stayed for more than 10 minutes gets 다시 처리 (its job may have died); the limit is a prop', () => {
    const old = webhookEvent({ id: 5, status: 'RECEIVED', receivedAt: minutesBefore(11) })
    const young = webhookEvent({ id: 6, status: 'RECEIVED', receivedAt: minutesBefore(9) })
    const count = (props: Partial<ComponentProps<typeof WebhookEventTable>>) =>
      (html({ events: [old, young], onRetryEvent: noop, now, ...props }).match(/<button/g) ?? [])
        .length
    expect(count({})).toBe(1)
    expect(count({ staleReceivedAfterMs: 5 * 60_000 })).toBe(2)
    expect(count({ staleReceivedAfterMs: 15 * 60_000 })).toBe(0)
  })

  it('a row already 처리됨 or 건너뜀 has no 다시 처리', () => {
    const out = html({
      events: [
        webhookEvent({ id: 1, status: 'PROCESSED', receivedAt: minutesBefore(500) }),
        webhookEvent({ id: 2, status: 'IGNORED', receivedAt: minutesBefore(500) }),
      ],
      onRetryEvent: noop,
      now,
    })
    expect(out).not.toContain('<button')
  })

  it('a row that was just put back says so as a status text and hides its button; the other rows keep theirs', () => {
    const events = [
      webhookEvent({ id: 2, status: 'FAILED' }),
      webhookEvent({ id: 3, status: 'DEAD', orderId: null }),
    ]
    const out = html({ events, onRetryEvent: noop, now, retried: { 2: now - 60_000 } })
    expect(out).toMatch(/<[a-z]+ role="status"[^>]*>다시 넣었어요</)
    expect(out.match(/<button/g)).toHaveLength(1)
    expect(out).toContain('(tgen_9f8e7d)') // the second row's button
    expect(out).not.toContain('(ord_1)')
  })

  it('a row put back stays quiet for the stale window even though the list was read again and its receivedAt is still old (a re-read must not bring the button back while the job is still running)', () => {
    // 다시 넣은 줄은 `RECEIVED` 가 되지만 `receivedAt` 은 그대로다 - 오래된 값으로 읽으면 단추가 곧바로 다시 나온다
    const events = [
      webhookEvent({ id: 5, status: 'RECEIVED', orderId: 'ord_5', receivedAt: minutesBefore(40) }),
    ]
    const pressed = html({
      events,
      onRetryEvent: noop,
      now,
      retried: { 5: now - 2 * 60_000 },
    })
    expect(pressed).toContain('다시 넣었어요')
    expect(pressed).not.toContain('<button')
    const notPressed = html({ events, onRetryEvent: noop, now })
    expect(notPressed.match(/<button/g)).toHaveLength(1)
  })

  it('the button comes back once the window has passed since it was pressed (staleReceivedAfterMs) - the job may have died after all', () => {
    const events = [
      webhookEvent({ id: 5, status: 'RECEIVED', orderId: 'ord_5', receivedAt: minutesBefore(40) }),
    ]
    const out = html({
      events,
      onRetryEvent: noop,
      now,
      retried: { 5: now - 11 * 60_000 },
    })
    expect(out).not.toContain('다시 넣었어요')
    expect(out.match(/<button/g)).toHaveLength(1)
    const longer = html({
      events,
      onRetryEvent: noop,
      now,
      staleReceivedAfterMs: 30 * 60_000,
      retried: { 5: now - 11 * 60_000 },
    })
    expect(longer).toContain('다시 넣었어요')
  })

  it('a put-back row that has since been handled says nothing (its status tells the truth) and has no button', () => {
    const out = html({
      events: [webhookEvent({ id: 2, status: 'PROCESSED' })],
      onRetryEvent: noop,
      now,
      retried: { 2: now - 60_000 },
    })
    expect(out).not.toContain('다시 넣었어요')
    expect(out).not.toContain('<button')
  })

  it('the resource column is the order\'s own payment key; an order that has none yet is written as "order:<id>" and read as: no provider payment number (payment <id>), never as a code', () => {
    const out = html({
      events: [
        webhookEvent({ id: 1, status: 'IGNORED', resourceId: 'order:ord_5', orderId: 'ord_5' }),
        webhookEvent({ id: 2, status: 'IGNORED', resourceId: 'tgen_9f8e7d' }),
      ],
      now,
    })
    expect(out).toContain('결제사 결제 번호 없음 (결제 ord_5)')
    expect(out).not.toContain('order:ord_5')
    expect(out).toContain('tgen_9f8e7d')
  })

  it('the row being sent shows a spinner, not the "put back" text', () => {
    const out = html({
      events: [webhookEvent({ id: 2, status: 'FAILED' })],
      onRetryEvent: noop,
      now,
      retryingId: 2,
    })
    expect(out).not.toContain('다시 넣었어요')
    expect(out).toContain('aria-busy="true"')
  })

  it('a marker row says what it is in words — still waiting for the one check at the end of the window, or already checked — and never shows its code', () => {
    const marker = (status: 'RECEIVED' | 'PROCESSED' | 'IGNORED', receivedAt = minutesBefore(2)) =>
      webhookEvent({
        id: 9,
        resourceType: 'LIMIT_MARKER',
        eventType: 'LIMIT_REACHED',
        resourceId: 'tgen_9f8e7d',
        status,
        deliveries: 41,
        receivedAt,
      })
    const waiting = html({ events: [marker('RECEIVED')], onRetryEvent: noop, now })
    expect(waiting).toContain('이 결제의 알림이 너무 많이 와서, 잠시 뒤 한 번에 확인해요')
    expect(waiting).not.toContain('확인했어요')
    for (const status of ['PROCESSED', 'IGNORED'] as const) {
      const done = html({ events: [marker(status)], onRetryEvent: noop, now })
      expect(done, status).toContain('이 결제의 알림이 너무 많이 와서, 한 번에 확인했어요')
      expect(done, status).not.toContain('잠시 뒤 한 번에')
      expect(done, status).not.toContain('<button')
    }
    expect(waiting).not.toContain('LIMIT_REACHED')
    expect(waiting).not.toContain('LIMIT_MARKER')
    expect(waiting).toContain('41')
    // 오래 머문 표식 줄만 단추가 있고, 낭독 이름은 짧은 명사
    expect(waiting).not.toContain('<button')
    const stale = html({
      events: [marker('RECEIVED', minutesBefore(30))],
      onRetryEvent: noop,
      now,
    })
    expect(stale).toContain('aria-label="다시 처리: 알림 몰림 (ord_1)"')
    // 보통 줄은 그대로 코드로
    expect(html({ events: rows, now })).toContain('PAYMENT_STATUS_CHANGED')
  })

  it('a marker row whose one check failed (처리 안 됨) says the job is trying again - it does not say nobody will; only a dead one (처리 못 함) asks for a hand', () => {
    const marker = (status: 'FAILED' | 'DEAD') =>
      html({
        events: [
          webhookEvent({
            id: 9,
            resourceType: 'LIMIT_MARKER',
            eventType: 'LIMIT_REACHED',
            status,
            deliveries: 41,
          }),
        ],
        onRetryEvent: noop,
        now,
      })
    const failed = marker('FAILED')
    expect(failed).toContain('확인하지 못해 다시 시도하고 있어요')
    expect(failed).not.toContain('다시 처리해 주세요')
    expect(failed).not.toContain('잠시 뒤 한 번에')
    expect(failed).toContain('aria-label="다시 처리: 알림 몰림 (ord_1)"') // the retry button is there
    const dead = marker('DEAD')
    expect(dead).toContain('확인하지 못했어요. 다시 처리해 주세요')
    expect(dead).not.toContain('다시 시도하고 있어요')
    expect(dead).not.toContain('잠시 뒤 한 번에')
    expect(dead).toContain('aria-label="다시 처리: 알림 몰림 (ord_1)"')
  })

  it('a put-back row that went DEAD inside the quiet window shows its button again (a hand is needed) and not the "put back" text', () => {
    const out = html({
      events: [webhookEvent({ id: 5, status: 'DEAD', orderId: 'ord_5' })],
      onRetryEvent: noop,
      now,
      retried: { 5: now - 2 * 60_000 },
    })
    expect(out).not.toContain('다시 넣었어요')
    expect(out.match(/<button/g)).toHaveLength(1)
  })

  it('the row that is being sent again shows a spinner on its own button', () => {
    const out = html({ events: rows, onRetryEvent: noop, retryingId: 2, now })
    expect(out).toContain('다시 시도하는 중')
    expect(out.match(/aria-busy="true"/g)).toHaveLength(1)
  })

  it('a status this package has not heard of is 확인 필요, never the code', () => {
    const out = html({
      events: [webhookEvent({ status: 'SOMETHING' as never })],
      onRetryEvent: noop,
    })
    expect(out).toContain('확인 필요')
    expect(out).not.toContain('SOMETHING')
  })

  it('empty, loading, error and 더 보기 behave like the other lists', () => {
    expect(html({})).toContain('받은 웹훅이 없어요')
    expect(html({ events: rows, loading: true })).toContain('불러오는 중')
    expect(html({ events: rows, error: true, onRetry: noop })).toContain('다시 불러오기')
    expect(html({ events: rows, onLoadMore: noop })).toContain('더 보기')
  })
})
