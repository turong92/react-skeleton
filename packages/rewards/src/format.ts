export type FormatMoneyOptions = {
  locale?: string
  /** 통화 → 금액 뒤에 붙는 글자(`{ KRW: '원' }`). 없으면 `Intl` 의 통화 표기 */
  currencySuffix?: Readonly<Record<string, string>>
}

/** 금액(최소 단위 정수)을 통화에 맞게 쓴다. 통화를 모르면(null) 숫자만 */
export function formatMoney(
  amount: number,
  currency: string | null,
  { locale, currencySuffix }: FormatMoneyOptions = {},
): string {
  if (!currency) return new Intl.NumberFormat(locale).format(amount)
  try {
    const money = new Intl.NumberFormat(locale, { style: 'currency', currency })
    const digits = money.resolvedOptions().maximumFractionDigits ?? 0
    const value = amount / 10 ** digits
    const suffix = currencySuffix?.[currency]
    if (suffix)
      return (
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value) + suffix
      )
    return money.format(value)
  } catch {
    return `${amount} ${currency}`
  }
}
