import { ApiRequestError } from '@skeleton/api-client'
import { koPaymentLabels } from '@skeleton/payment'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PaymentFailedNotice } from './PaymentFailedNotice'

const serverError = new ApiRequestError(
  {
    code: 'PAYMENT.REFUND_NOT_FOUND',
    title: 'Refund not found (server wording)',
    detail: 'No such refund (server wording)',
    status: 404,
    timestamp: 't',
    traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  },
  '4bf92f3577b34da6a3ce929d0e0e4736',
  'span',
  'tp',
)

describe('PaymentFailedNotice — a payment action that did not go through, said in place', () => {
  it('says our sentence and keeps the reference number, never the server wording', () => {
    const html = renderToStaticMarkup(
      <PaymentFailedNotice error={serverError} labels={koPaymentLabels}>
        요청을 거두지 못했어요.
      </PaymentFailedNotice>,
    )
    expect(html).toContain('요청을 거두지 못했어요.')
    expect(html).toContain('4bf92f3577b34da6a3ce929d0e0e4736')
    expect(html).not.toContain('server wording')
    expect(html).toMatch(/role="alert"|aria-live/)
  })
})
