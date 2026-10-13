import { usePaddlePrices, usePaymentConfig, type PaddlePrices } from '@skeleton/payment'
import { paymentApi } from '../cheer/api'

/**
 * 금액 자리에 무엇을 그릴까. Paddle 로 결제할 화면에서는 우리 표의 원화 금액이 아니라 **Paddle 가격**(구매자 통화)이 결제 금액이다 -
 * 못 받았으면 틀린 금액(원화)으로 되돌아가지 않고 `failed` 로 금액을 숨긴다. 토스 경로(와 결제사를 아직 모를 때)는 `table`: 서버 표 그대로.
 */
export type AmountSlot =
  | { kind: 'table' }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'paddle'; text: string }

export function amountSlotOf(
  provider: string | undefined,
  prices: Pick<PaddlePrices, 'status' | 'priceOf'>,
  code: string,
): AmountSlot {
  if (provider !== 'paddle') return { kind: 'table' }
  if (prices.status === 'loading') return { kind: 'loading' }
  const text = prices.status === 'ready' ? prices.priceOf(code) : undefined
  return text ? { kind: 'paddle', text } : { kind: 'failed' }
}

/** 고른 결제사가 Paddle 일 때만 가격 미리보기를 불러, 코드별 금액 자리를 돌려준다 */
export function usePaddleAmounts(provider: string | undefined): (code: string) => AmountSlot {
  const config = usePaymentConfig(paymentApi)
  const preview = provider === 'paddle' ? config.data?.pricePreviews?.paddle : undefined
  const prices = usePaddlePrices(preview)
  return (code) => amountSlotOf(provider, prices, code)
}
