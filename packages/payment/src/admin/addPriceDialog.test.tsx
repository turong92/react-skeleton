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

  it('offers only the selling prices of the same period and currency to replace, and says the old one stops', () => {
    const price = (over: object) => ({
      code: 'x',
      period: 'P1M',
      amount: 6900,
      currency: 'KRW',
      compareAtAmount: null,
      saleStartsAt: null,
      saleEndsAt: null,
      selling: true,
      current: true,
      stoppedAt: null,
      providerRefs: {},
      ...over,
    })
    const html = render({
      locale: 'ko-KR',
      prices: [
        price({ code: 'same' }),
        price({ code: 'other-period', period: 'P1Y' }),
        price({ code: 'other-currency', currency: 'USD' }),
        price({ code: 'stopped', selling: false, stoppedAt: '2026-10-01T00:00:00Z' }),
      ],
    })
    expect(html).toContain('이 가격을 대신함 (선택)')
    expect(html).toContain('same (6,900원)')
    for (const gone of ['other-period', 'other-currency', 'stopped'])
      expect(html).not.toContain(gone)
    expect(render({ prices: [] })).not.toContain('이 가격을 대신함')
  })

  it('a replaces rejection (unknown code) is said under that field', () => {
    const error = new ApiRequestError(
      {
        code: 'CATALOG.PRICE_INVALID',
        title: 't',
        status: 400,
        timestamp: 't',
        errors: [{ field: 'replaces', code: 'Invalid', message: 'not a price of this product' }],
      },
      'tr',
      'sp',
      'tp',
    )
    const price = {
      code: 'same',
      period: 'P1M',
      amount: 6900,
      currency: 'KRW',
      compareAtAmount: null,
      saleStartsAt: null,
      saleEndsAt: null,
      selling: true,
      current: true,
      stoppedAt: null,
      providerRefs: {},
    }
    expect(render({ error, prices: [price] })).toContain('not a price of this product')
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
