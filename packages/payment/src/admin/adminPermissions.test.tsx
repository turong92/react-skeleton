import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { adminOrder, adminRefund, webhookEvent } from '../test/fixtures'
import { AdminOrderPanel } from './AdminOrderPanel'
import { RefundRequestTable } from './RefundRequestTable'
import { WebhookEventTable } from './WebhookEventTable'

const common = { labels: koPaymentLabels, locale: 'ko-KR', formatTime: () => '2026. 1. 1.' }
const noop = () => undefined
const noOperate = (key: string) => key !== 'payment.operate'
const noRefund = (key: string) => key !== 'payment.refund'

const panel = (can?: (key: string) => boolean) =>
  renderToStaticMarkup(
    <AdminOrderPanel
      {...common}
      can={can}
      detail={{
        order: adminOrder(),
        refunds: [adminRefund({ status: 'REQUESTED' })],
        events: [],
      }}
      onRefund={noop}
      onApprove={noop}
      onReject={noop}
      onSync={noop}
    />,
  )

describe('payment admin parts follow `can`', () => {
  it('without `can` everything is there (existing apps unchanged)', () => {
    const html = panel()
    for (const label of ['환불하기', '요청대로 환불하기', '요청 거절하기', '결제사와 맞추기'])
      expect(html, label).toContain(label)
  })

  it('no payment.operate: the sync button is gone, refunds stay', () => {
    const html = panel(noOperate)
    expect(html).not.toContain('결제사와 맞추기')
    expect(html).toContain('환불하기')
    expect(html).toContain('요청 거절하기')
  })

  it('no payment.refund: refund, approve and reject are gone, sync stays', () => {
    const html = panel(noRefund)
    expect(html).not.toContain('환불하기')
    expect(html).not.toContain('요청 거절하기')
    expect(html).toContain('결제사와 맞추기')
  })

  it('the refund request table hides approve and reject without payment.refund', () => {
    const render = (can?: (key: string) => boolean) =>
      renderToStaticMarkup(
        <RefundRequestTable
          {...common}
          can={can}
          refunds={[adminRefund({ status: 'REQUESTED' })]}
          onApprove={noop}
          onReject={noop}
        />,
      )
    expect(render()).toContain('요청 거절하기')
    expect(render(noRefund)).not.toContain('요청 거절하기')
    expect(render(noRefund)).not.toContain('요청대로 환불하기')
  })

  it('the webhook table hides retry without payment.operate', () => {
    const render = (can?: (key: string) => boolean) =>
      renderToStaticMarkup(
        <WebhookEventTable
          {...common}
          can={can}
          events={[webhookEvent({ id: 2, status: 'FAILED', lastError: 'X', deliveries: 3 })]}
          onRetryEvent={noop}
        />,
      )
    expect(render()).toContain('<button')
    expect(render(noOperate)).not.toContain('<button')
  })
})
