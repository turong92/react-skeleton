import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { CloseSubscriptionChargeDialog } from './CloseSubscriptionChargeDialog'

const noop = () => undefined
const render = (props: object = {}) =>
  renderToStaticMarkup(
    <CloseSubscriptionChargeDialog
      open
      onClose={noop}
      onConfirm={noop}
      labels={koPaymentLabels}
      {...props}
    />,
  )
const failed = (code: string, status: number) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't', traceId: 'tr' }, 'tr', 'sp', 'tp')

describe('CloseSubscriptionChargeDialog', () => {
  it('says the provider is asked once more and a paid charge is not closed, before anything is pressed', () => {
    const html = render()
    expect(html).toContain('결제 안 됨」으로 닫을까요?')
    expect(html).toContain('한 번 더 물어보고')
    expect(html).toContain('닫지 않고 결제됨으로 맞춰요')
    expect(html).toContain('다시 구독할 수 있어요')
  })

  it('a charge that cannot be closed says why; any other error is the general sentence', () => {
    expect(render({ error: failed('PAYMENT.ORDER_NOT_CLOSABLE', 409) })).toContain(
      '지금은 닫을 수 없는 결제예요',
    )
    expect(render({ error: failed('PAYMENT.UNAVAILABLE', 503) })).toContain('닫지 못했어요')
  })
})
