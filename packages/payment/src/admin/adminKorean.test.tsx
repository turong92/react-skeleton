import { ApiRequestError } from '@skeleton/api-client'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { adminOrder, adminRefund, order, paymentEvent, webhookEvent } from '../test/fixtures'
import { AdminOrderPanel } from './AdminOrderPanel'
import { AdminOrderTable } from './AdminOrderTable'
import { AdminRefundDialog } from './AdminRefundDialog'
import { RefundRequestTable } from './RefundRequestTable'
import { WebhookEventTable } from './WebhookEventTable'

/*
 * 한국어 문구를 넘기면 영어가 남지 않는다 — 문구 걷기(labels.test)는 부품이 스스로 그리는 글자(스피너 · 오류 말머리 · 닫기 단추)를 못 본다.
 * 태그를 벗긴 글자와 aria-label 값에서 영어 낱말을 찾는다(코드 · 번호 모양의 값은 낱말이 아니다).
 */
const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 1. 1.' }
const noop = () => undefined
const readable = (html: string) =>
  [
    ...html.replace(/<[^>]*>/g, '\n').split('\n'),
    ...[...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1] ?? ''),
  ].join('\n')
const ENGLISH =
  /\b(Error|Loading|Close|Copy|Copied|Reference|Info|Success|Warning|Dismiss|Confirm|Cancel|Details|Refund|Payment|Search|Find)\b/

const failed = (code: string, status: number, data?: unknown) =>
  new ApiRequestError(
    { code, title: 't', status, timestamp: 't', traceId: 'trace-1', data },
    'trace-1',
    'sp',
    'tp',
  )
const detail = {
  order: adminOrder({ reviewReason: 'AMOUNT_MISMATCH', failureCode: 'X', refundPending: true }),
  refunds: [adminRefund({ failureCode: 'Y' }), adminRefund({ id: 'b', status: 'SUCCEEDED' })],
  events: [
    paymentEvent({ providerCode: 'Z', traceId: 't-1' }),
    paymentEvent({ id: 2, type: 'NEW' }),
  ],
}

const cases: Array<[string, ReactElement]> = [
  [
    'order table with rows, filter, busy 더 보기',
    <AdminOrderTable
      {...common}
      orders={[adminOrder({ reviewReason: 'MODE_MISMATCH' })]}
      onOpen={noop}
      filter={{ status: '', q: '' }}
      onFilterChange={noop}
      onLoadMore={noop}
      loadingMore
    />,
  ],
  ['order table loading', <AdminOrderTable {...common} orders={[]} loading />],
  ['order table error', <AdminOrderTable {...common} orders={[]} error onRetry={noop} />],
  [
    'order table nothing matches',
    <AdminOrderTable
      {...common}
      orders={[]}
      filter={{ status: 'PAID', q: 'x' }}
      onFilterChange={noop}
    />,
  ],
  [
    'panel with everything',
    <AdminOrderPanel
      {...common}
      detail={detail}
      onRefund={noop}
      onApprove={noop}
      onReject={noop}
      onSync={noop}
      syncing
      syncError={failed('PAYMENT.UNAVAILABLE', 503)}
    />,
  ],
  [
    'panel synced',
    <AdminOrderPanel
      {...common}
      detail={{ ...detail, events: [] }}
      onSync={noop}
      synced={{ reviewReason: null }}
    />,
  ],
  [
    'direct dialog with a refusal and a reference',
    <AdminRefundDialog
      {...common}
      open
      mode="direct"
      order={order()}
      onClose={noop}
      onConfirm={noop}
      error={failed('PAYMENT.REFUND_DECLINED', 402, { category: 'TEMPORARY', providerCode: 'P' })}
    />,
  ],
  [
    'direct dialog busy',
    <AdminRefundDialog
      {...common}
      open
      mode="direct"
      order={order()}
      onClose={noop}
      onConfirm={noop}
      busy
    />,
  ],
  [
    'approve dialog too big',
    <AdminRefundDialog
      {...common}
      open
      mode="approve"
      request={adminRefund()}
      order={{ refundableAmount: 1 }}
      onClose={noop}
      onConfirm={noop}
    />,
  ],
  [
    'reject dialog with an error',
    <AdminRefundDialog
      {...common}
      open
      mode="reject"
      request={adminRefund()}
      onClose={noop}
      onConfirm={noop}
      error={failed('COMMON.INTERNAL', 500)}
    />,
  ],
  [
    'refund request table',
    <RefundRequestTable
      {...common}
      refunds={[adminRefund()]}
      onApprove={noop}
      onReject={noop}
      onOpenOrder={noop}
      onLoadMore={noop}
    />,
  ],
  ['refund request table empty', <RefundRequestTable {...common} refunds={[]} />],
  [
    'webhook table',
    <WebhookEventTable
      {...common}
      events={[webhookEvent({ status: 'FAILED', lastError: 'LOOKUP_UNAVAILABLE' })]}
      onRetryEvent={noop}
      retryingId={7}
    />,
  ],
]

describe('nothing English is left on a Korean operator screen', () => {
  it.each(cases)('%s', (_name, element) => {
    const text = readable(renderToStaticMarkup(element))
    expect(text).not.toMatch(ENGLISH)
  })

  it('the walker does see English when it is there (the check is not vacuous)', () => {
    const html = renderToStaticMarkup(
      <AdminOrderTable orders={[]} loading labels={{ list: { loading: 'Loading' } }} />,
    )
    expect(readable(html)).toMatch(ENGLISH)
  })
})
