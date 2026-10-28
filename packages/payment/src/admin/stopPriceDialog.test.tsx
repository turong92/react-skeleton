import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPaymentLabels } from '../labels'
import { StopPriceDialog } from './StopPriceDialog'

const noop = () => undefined
const price = { code: 'standard-year', amount: 59000, currency: 'KRW' }
const render = (props: object = {}) =>
  renderToStaticMarkup(
    <StopPriceDialog
      open
      onClose={noop}
      onConfirm={noop}
      price={price}
      labels={koPaymentLabels}
      locale="ko-KR"
      {...props}
    />,
  )
const failed = (code: string, status: number) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't', traceId: 'tr' }, 'tr', 'sp', 'tp')

describe('StopPriceDialog', () => {
  it('says which price, and that existing subscribers keep it, before anything is pressed', () => {
    const html = render()
    expect(html).toContain('이 가격의 판매를 중지할까요?')
    expect(html).toContain('standard-year · 59,000원')
    expect(html).toContain('기존 구독자는 이 가격 그대로')
    expect(html).toContain('되돌릴 수 없어요')
  })

  it('a price that no longer exists says so; any other error is the general sentence', () => {
    expect(render({ error: failed('CATALOG.NOT_FOUND', 404) })).toContain(
      '찾는 상품이나 가격이 없어요',
    )
    expect(render({ error: failed('COMMON.INTERNAL_SERVER_ERROR', 500) })).toContain(
      '저장하지 못했어요',
    )
  })
})
