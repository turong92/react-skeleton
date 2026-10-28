import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { AddPriceDialog } from './AddPriceDialog'

const noop = () => undefined
const render = (props: object = {}) =>
  renderToStaticMarkup(
    <AddPriceDialog
      open
      onClose={noop}
      onSubmit={noop}
      kind="SUBSCRIPTION"
      labels={koPaymentLabels}
      {...props}
    />,
  )
const failed = (code: string, status: number) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't', traceId: 'tr' }, 'tr', 'sp', 'tp')

describe('AddPriceDialog', () => {
  it('a subscription price asks for the period, the currency and the amount; the amount is required; the sale fields wait behind the switch', () => {
    const html = render()
    expect(html).toContain('가격 더하기')
    expect(html).toContain('결제 주기')
    expect(html).toContain('월간 (P1M)')
    expect(html).toContain('연간 (P1Y)')
    expect(html).toContain('KRW')
    expect(html).toContain('USD')
    expect(html).toContain('금액')
    expect(html).toContain('행사가로 팔기')
    expect(html).not.toContain('시작 시각')
    expect(html).not.toContain('datetime-local')
  })

  it('a one-time price has no period field', () => {
    const html = render({ kind: 'ONE_TIME' })
    expect(html).not.toContain('결제 주기')
    expect(html).toContain('금액')
  })

  it('the submit is the filled primary button and 「닫기」 the bordered one', () => {
    const html = render()
    expect(html).toMatch(/data-variant="primary"[^>]*>가격 더하기/)
    expect(html).toMatch(/data-variant="secondary"[^>]*>닫기/)
  })

  it('a rejected add says why in words: overlapping sale periods, an invalid price, a taken code', () => {
    expect(render({ error: failed('CATALOG.PRICE_OVERLAP', 409) })).toContain(
      '판매 기간이 겹치는 가격',
    )
    expect(render({ error: failed('CATALOG.PRICE_INVALID', 400) })).toContain(
      '가격 값이 올바르지 않아요',
    )
    expect(render({ error: failed('CATALOG.CODE_TAKEN', 409) })).toContain('이미 쓰는 코드')
  })

  it('while adding, the fields are locked and the button spins', () => {
    const html = render({ busy: true })
    expect(html).toContain('aria-busy="true"')
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('a price rejection with field names puts each reason under its own field (compareAtAmount under the regular price)', () => {
    const error = new ApiRequestError(
      {
        code: 'CATALOG.PRICE_INVALID',
        title: 't',
        status: 400,
        timestamp: 't',
        errors: [
          { field: 'amount', code: 'Min', message: 'amount too small' },
          { field: 'compareAtAmount', code: 'Min', message: 'regular too small' },
        ],
      },
      'tr',
      'sp',
      'tp',
    )
    const html = render({ error })
    expect(html).toContain('amount too small')
    // 정가 칸은 「행사가로 팔기」를 켜야 보인다 - 꺼져 있으면 칸이 없다
    expect(html).not.toContain('regular too small')
  })

  it('a rejection with no field (a state refusal) shows the server detail in the band', () => {
    const error = new ApiRequestError(
      {
        code: 'CATALOG.PRICE_INVALID',
        title: 't',
        status: 400,
        detail: 'the price is stopped',
        timestamp: 't',
      },
      'tr',
      'sp',
      'tp',
    )
    expect(render({ error })).toContain('the price is stopped')
  })
})
