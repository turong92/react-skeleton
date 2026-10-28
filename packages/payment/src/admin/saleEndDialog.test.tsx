import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultPaymentLabels, koPaymentLabels } from '../labels'
import { SaleEndDialog } from './SaleEndDialog'

const noop = () => undefined
const price = {
  code: 'std-y',
  amount: 59000,
  currency: 'KRW',
  saleStartsAt: null,
  saleEndsAt: '2026-11-30T12:00:00Z',
}
const render = (props: object = {}, labels = koPaymentLabels) =>
  renderToStaticMarkup(
    <SaleEndDialog
      open
      onClose={noop}
      onSubmit={noop}
      price={price}
      labels={labels}
      locale="ko-KR"
      {...props}
    />,
  )

describe('SaleEndDialog', () => {
  it('names the price, fills the current end, and has a filled submit and a bordered close', () => {
    const html = render()
    expect(html).toContain('행사 기간 바꾸기')
    expect(html).toContain('std-y · 59,000원')
    expect(html).toContain('type="datetime-local"')
    expect(html).toMatch(/value="2026-11-30T\d\d:\d\d"/)
    expect(html).toMatch(/data-variant="primary"[^>]*>바꾸기/)
    expect(html).toMatch(/data-variant="secondary"[^>]*>닫기/)
  })

  it('has English words too', () => {
    const html = render({}, defaultPaymentLabels)
    expect(html).toContain('Change sale period')
    expect(html).toContain('Ends at')
  })

  it('a rejected change says why', () => {
    const error = new ApiRequestError(
      { code: 'CATALOG.PRICE_OVERLAP', title: 't', status: 409, timestamp: 't', traceId: 'tr' },
      'tr',
      'sp',
      'tp',
    )
    expect(render({ error })).toContain('판매 기간이 겹치는 가격')
  })
})
