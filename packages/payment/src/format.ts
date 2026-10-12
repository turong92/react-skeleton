import type { OrderCard } from './ledgerTypes'
import type { PaymentLabels } from './labels'
import type { PaymentAmount } from './types'

export type FormatMoneyOptions = {
  locale?: string
  /** 통화 → 금액 뒤에 붙는 글자(`{ KRW: '원' }`). 없거나 빈 글자면 `Intl` 의 통화 표기 */
  currencySuffix?: Readonly<Record<string, string>>
}

/**
 * 금액(최소 단위 정수)을 통화에 맞게 쓴다. 원은 `3,000원`(문구 `currencySuffix`), 그 밖에는 `Intl.NumberFormat` 의 통화 표기.
 * 최소 단위의 자릿수는 `Intl` 이 통화별로 안다(KRW 0 · USD 2).
 */
export function formatMoney(
  { amount, currency }: PaymentAmount,
  { locale, currencySuffix }: FormatMoneyOptions = {},
): string {
  try {
    const money = new Intl.NumberFormat(locale, { style: 'currency', currency })
    const digits = money.resolvedOptions().maximumFractionDigits ?? 0
    const value = amount / 10 ** digits
    const suffix = currencySuffix?.[currency]
    if (suffix) {
      return (
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value) + suffix
      )
    }
    return money.format(value)
  } catch {
    return `${amount} ${currency}` // 모르는 통화 코드 — 숫자만이라도 보인다
  }
}

/**
 * 결제 수단 한 줄 — 카드는 「현대카드 ····1234」(끝 네 글자는 온 그대로 · `*` 가 섞여도 그대로).
 * 문구에 없는 카드사 코드는 「카드」, 끝 네 글자가 없으면 이름만, 카드 칸이 없거나 둘 다 비었으면 수단 종류(「카드」 · 「간편결제」)만.
 * 수단 종류도 모르면 `null` — 보이지 않는다.
 */
export function cardDisplay(
  order: { method: string | null; card: OrderCard | null },
  labels: Pick<PaymentLabels, 'methods' | 'issuers' | 'cardFallback'>,
): string | null {
  const { card } = order
  if (card && (card.issuer || card.last4)) {
    const name = lookup(labels.issuers, card.issuer) || labels.cardFallback
    return card.last4 ? `${name} ····${card.last4}` : name
  }
  return lookup(labels.methods, order.method) || null
}

const PERIOD = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/
const PERIOD_UNITS = ['year', 'month', 'week', 'day', 'hour', 'minute'] as const

/**
 * 「3,900원 · 1개월마다 결제」 - 금액과 ISO-8601 주기(`P1M` · `P3M` · `PT3M`)의 첫 0 아닌 단위. 읽을 수 없는 주기(복합 · 0 · 모르는 글자)는 코드를 그리지 않고 금액만 쓴다.
 */
export function priceEveryDisplay(
  amount: PaymentAmount,
  period: string,
  labels: Pick<PaymentLabels, 'currencySuffix' | 'subscription'>,
  locale?: string,
): string {
  const money = formatMoney(amount, { locale, currencySuffix: labels.currencySuffix })
  const match = PERIOD.exec(period)
  const counts = match?.slice(1).map((part) => Number(part ?? 0))
  const at = counts?.findIndex((count) => count > 0) ?? -1
  const unit = at >= 0 ? PERIOD_UNITS[at] : undefined
  if (!counts || unit === undefined) return money
  return labels.subscription.priceEvery(money, labels.subscription.periodUnit[unit](counts[at]!))
}

/**
 * 문구 표를 코드로 찾는다 — 표에 **자기 것**으로 있는 코드만 찾는다. 서버가 보낸 코드가 `constructor` · `toString` 같은 이름이어도
 * `Object.prototype` 의 함수를 문구로 꺼내 오지 않는다.
 */
export function lookup<T>(
  table: Readonly<Record<string, T>>,
  code: string | null | undefined,
): T | undefined {
  return code != null && Object.hasOwn(table, code) ? table[code] : undefined
}

/**
 * 운영자가 금액을 고쳐 환불한 줄이면 「요청 5,000원」 - 환불한 금액(`amount`)과 처음 요청한 금액이 다를 때만, 아니면 `null`.
 * 환불 금액은 그대로 두고 옆에 붙인다(사용자 · 운영자 화면이 같이 쓴다).
 */
export function requestedAmountNote(
  refund: { amount: PaymentAmount; requestedAmount?: PaymentAmount | null },
  labels: Pick<PaymentLabels, 'currencySuffix' | 'summary'>,
  locale?: string,
): string | null {
  const { requestedAmount } = refund
  if (!requestedAmount || requestedAmount.amount === refund.amount.amount) return null
  return labels.summary.requestedAmountNote(
    formatMoney(requestedAmount, { locale, currencySuffix: labels.currencySuffix }),
  )
}
