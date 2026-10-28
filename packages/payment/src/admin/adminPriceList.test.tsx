import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { AdminPriceList } from './AdminPriceList'
import type { AdminCatalogPrice } from './catalogAdminTypes'

const now = new Date('2026-11-01T00:00:00Z')
const price = (over: Partial<AdminCatalogPrice> = {}): AdminCatalogPrice => ({
  code: 'std-m',
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
const noop = () => undefined
const render = (prices: AdminCatalogPrice[], props: object = {}) =>
  renderToStaticMarkup(
    <AdminPriceList
      prices={prices}
      now={now}
      locale="ko-KR"
      formatTime={(iso) => iso.slice(0, 10)}
      labels={koPaymentLabels}
      {...props}
    />,
  )

describe('AdminPriceList', () => {
  it('groups prices by currency and says each price state in words', () => {
    const html = render(
      [
        price(),
        price({ code: 'std-m-usd', currency: 'USD', amount: 699 }),
        price({ code: 'old', current: false, stoppedAt: '2026-10-01T00:00:00Z', selling: false }),
        price({ code: 'soon', current: false, saleStartsAt: '2026-12-01T00:00:00Z' }),
      ],
      { onStop: noop },
    )
    expect(html).toContain('KRW 가격')
    expect(html).toContain('USD 가격')
    expect(html).toContain('$6.99')
    expect(html).toContain('지금 팔려요')
    expect(html).toContain('판매 중지')
    expect(html).toContain('행사 예정')
  })

  it('a sale shows the regular price and its window', () => {
    const html = render([
      price({
        code: 'std-y',
        period: 'P1Y',
        amount: 59000,
        compareAtAmount: 69000,
        saleStartsAt: '2026-11-01T00:00:00Z',
        saleEndsAt: '2026-11-02T00:00:00Z',
      }),
    ])
    expect(html).toContain('정가 69,000원')
    expect(html).toContain('2026-11-01부터')
    expect(html).toContain('2026-11-02까지')
    expect(html).toContain('연간')
  })

  it('「판매 중지」 is a filled-border button named by the price code, and only on prices still selling', () => {
    const html = render(
      [
        price(),
        price({ code: 'gone', current: false, selling: false, stoppedAt: '2026-10-01T00:00:00Z' }),
      ],
      { onStop: noop },
    )
    expect(html).toMatch(/aria-label="판매 중지: std-m"/)
    expect(html).not.toContain('aria-label="판매 중지: gone"')
    expect(html).toMatch(
      /data-variant="secondary"[^>]*aria-label="판매 중지: std-m"|aria-label="판매 중지: std-m"[^>]*data-variant="secondary"/,
    )
    expect(render([price()])).not.toContain('aria-label="판매 중지:')
  })

  it('「가격 더하기」 is the filled primary button, only when the parent can open the dialog', () => {
    expect(render([price()], { onAdd: noop })).toMatch(/data-variant="primary"[^>]*>가격 더하기</)
    expect(render([price()])).not.toContain('가격 더하기')
  })

  it('no prices: says so', () => {
    expect(render([])).toContain('아직 가격이 없어요')
  })

  it('provider link cells exist only when the server lists a provider, show the linked id, and a linked price can be unlinked', () => {
    const usd = (over: Partial<AdminCatalogPrice> = {}) =>
      price({ code: 'std-m-usd', currency: 'USD', amount: 699, ...over })
    const none = render([usd()], { onSetProviderRef: noop, onRemoveProviderRef: noop })
    expect(none).not.toContain('결제사 가격 연결')
    const html = render([usd({ providerRefs: { paddle: 'pri_1' } })], {
      providers: ['paddle'],
      onSetProviderRef: noop,
      onRemoveProviderRef: noop,
    })
    expect(html).toContain('결제사 가격 연결')
    expect(html).toContain('value="pri_1"')
    expect(html).toContain('aria-label="연결 끊기: Paddle (std-m-usd)"')
    // 연결된 값과 같으면 「연결」은 잠긴다
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*aria-label="연결: Paddle \(std-m-usd\)"|<button[^>]*aria-label="연결: Paddle \(std-m-usd\)"[^>]*disabled/,
    )
  })

  it('the provider link cell is only in the table of a currency that provider sells in (Paddle: USD, not KRW - the app says so; the package default is every currency)', () => {
    const html = render([price(), price({ code: 'u', currency: 'USD', amount: 699 })], {
      providers: ['paddle'],
      providerCurrencies: { paddle: ['USD'] },
      onSetProviderRef: noop,
      onRemoveProviderRef: noop,
    })
    expect(html).toContain('Paddle 가격 id (u)')
    expect(html).not.toContain('Paddle 가격 id (std-m)')
  })

  it('without a currency map a provider is linkable in every currency table', () => {
    const html = render([price()], {
      providers: ['paddle'],
      onSetProviderRef: noop,
      onRemoveProviderRef: noop,
    })
    expect(html).toContain('Paddle 가격 id (std-m)')
  })

  it('unlinking asks first (the confirm dialog is there, closed text says what happens)', () => {
    const html = render([price({ currency: 'USD', providerRefs: { paddle: 'pri_1' } })], {
      providers: ['paddle'],
      onSetProviderRef: noop,
      onRemoveProviderRef: noop,
    })
    expect(html).toContain('결제사 가격 연결을 끊을까요?')
  })

  it('a product that is not on sale tells even its selling prices apart from a stopped one', () => {
    const html = render([price()], { productSelling: false })
    expect(html).toContain('상품 판매 중지')
    expect(html).not.toContain('지금 팔려요')
  })

  it('a stopped price has no link cell content', () => {
    const html = render(
      [price({ current: false, selling: false, stoppedAt: '2026-10-01T00:00:00Z' })],
      { providers: ['paddle'], onSetProviderRef: noop, onRemoveProviderRef: noop },
    )
    expect(html).not.toContain('Paddle 가격 id')
  })

  it('「행사 기간 바꾸기」 is a bordered button only on a selling sale price, named by its code', () => {
    const sale = price({
      code: 'sale',
      compareAtAmount: 9000,
      saleStartsAt: '2026-10-30T00:00:00Z',
    })
    const stopped = price({
      code: 'gone',
      compareAtAmount: 9000,
      selling: false,
      current: false,
      stoppedAt: '2026-10-01T00:00:00Z',
    })
    const html = render([sale, price({ code: 'plain' }), stopped], { onChangeSale: noop })
    expect(html).toMatch(
      /data-variant="secondary"[^>]*aria-label="행사 기간 바꾸기: sale"|aria-label="행사 기간 바꾸기: sale"[^>]*data-variant="secondary"/,
    )
    expect(html).not.toContain('행사 기간 바꾸기: plain')
    expect(html).not.toContain('행사 기간 바꾸기: gone')
    expect(render([sale])).not.toContain('행사 기간 바꾸기')
    // 시작도 끝도 없는 줄(상시 가격)에는 기간이 없다
    const open = price({ code: 'open', compareAtAmount: 9000 })
    expect(render([open], { onChangeSale: noop })).not.toContain('행사 기간 바꾸기: open')
  })

  it('a provider id that is already linked to another price says so on the link, not 「이미 쓰는 코드」', () => {
    const error = new ApiRequestError(
      { code: 'CATALOG.CODE_TAKEN', title: 't', status: 409, timestamp: 't', traceId: 'tr' },
      'tr',
      'sp',
      'tp',
    )
    const html = render([price()], { refError: error })
    expect(html).toContain('이미 다른 가격에 연결된 id')
    expect(html).not.toContain('이미 쓰는 코드')
  })

  it('a malformed provider id (field externalId) shows the server message in the band above the table', () => {
    const error = new ApiRequestError(
      {
        code: 'COMMON.VALIDATION_FAILED',
        title: 't',
        status: 400,
        timestamp: 't',
        errors: [{ field: 'externalId', code: 'Pattern', message: 'not a price id' }],
      },
      'tr',
      'sp',
      'tp',
    )
    const html = render([price()], { refError: error })
    expect(html).toContain('입력을 확인해 주세요')
    expect(html).toContain('not a price id')
  })
})
