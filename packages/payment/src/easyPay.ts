import type { PaymentConfig, TossPaymentWindowCheckout } from './ledgerTypes'

/** 토스 결제창이 바로 열 수 있는 간편결제 코드(백엔드 `TossEasyPays.CODES` 와 같은 표) - 이 패키지가 이름을 아는 것만 단추가 된다 */
export const EASY_PAY_CODES = [
  'TOSSPAY',
  'NAVERPAY',
  'KAKAOPAY',
  'SAMSUNGPAY',
  'LPAY',
  'PAYCO',
  'SSG',
  'APPLEPAY',
  'PINPAY',
] as const
export type EasyPayCode = (typeof EASY_PAY_CODES)[number]

const known = (code: string): code is EasyPayCode =>
  (EASY_PAY_CODES as readonly string[]).includes(code)

/**
 * 주문을 만들기 **전에** 단추를 그릴 목록 - `GET /config` 의 그 결제사 줄. 서버가 안 답했거나 결제사를 모르거나 구버전 서버(칸 없음)면 빈 목록 =
 * 지금 화면 그대로. 이름을 모르는 코드는 뺀다.
 */
export function easyPaysFor(
  config: PaymentConfig | undefined,
  provider: string | undefined,
): EasyPayCode[] {
  if (!provider) return []
  return (config?.easyPays?.[provider] ?? []).filter(known)
}

/** 이 결제창이 허락한 간편결제 - 서버가 `attributes.easyPays` 에 쉼표로 이어 준다 */
export function easyPaysOfCheckout(
  checkout: Pick<TossPaymentWindowCheckout, 'attributes'>,
): string[] {
  return (checkout.attributes?.easyPays ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
}
