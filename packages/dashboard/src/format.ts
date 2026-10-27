import { formatInstant } from '@skeleton/time'
import type { DashboardAmount, DashboardInterval, DashboardMetric, DashboardUnit } from './types'

export type FormatOptions = {
  locale?: string
  /** 통화 → 금액 뒤에 붙는 글자(`{ KRW: '원' }`). 없으면 `Intl` 의 통화 표기 */
  currencySuffix?: Readonly<Record<string, string>>
}

/** 돈(최소 단위 정수) — 자릿수는 `Intl` 이 통화별로 안다(KRW 0 · USD 2) */
export function formatMoney(
  amount: number,
  currency: string,
  { locale, currencySuffix }: FormatOptions = {},
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
 * 값 한 개를 단위에 맞게 쓴다. `PERCENT` 는 **100분의 1 퍼센트(bp)** 정수로 가정한다(3820 → 38.2%) — 계약 C1 이 자릿수를 정하지 않아 이 가정을 둔다.
 */
export function formatValue(
  amount: DashboardAmount,
  unit: DashboardUnit,
  options: FormatOptions = {},
): string {
  if (unit === 'MONEY' && amount.currency) {
    return formatMoney(amount.amount, amount.currency, options)
  }
  if (unit === 'PERCENT') {
    return `${new Intl.NumberFormat(options.locale, { maximumFractionDigits: 1 }).format(amount.amount / 100)}%`
  }
  return new Intl.NumberFormat(options.locale).format(amount.amount)
}

/** 그래프 · 순위의 숫자(통화 없음) */
export function formatCount(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

/** 그래프의 값 — 돈이면 타일의 첫 통화(`value[0]`)로 쓴다. 계약상 `series` 의 통화는 `value[0]` 의 통화이고, 매출이 0 인 기간도 설정 통화(없으면 직전 기간 통화) 0 한 줄이 온다 */
export function formatSeriesValue(
  value: number,
  metric: Pick<DashboardMetric, 'unit' | 'value'>,
  options: FormatOptions = {},
): string {
  return formatValue(
    {
      amount: value,
      currency: metric.unit === 'MONEY' ? (metric.value?.[0]?.currency ?? null) : null,
    },
    metric.unit,
    options,
  )
}

export type Delta =
  /** 비교를 끈 상태 — 아무것도 그리지 않는다 */
  | { kind: 'off' }
  /** 비교를 켰는데 서버가 직전 값을 주지 않았다(활성 이용자) 또는 값이 없다 */
  | { kind: 'unavailable' }
  /** 직전이 0 이라 퍼센트를 낼 수 없다 */
  | { kind: 'new' }
  | { kind: 'flat'; percent: 0 }
  | { kind: 'up' | 'down'; percent: number }

/** 직전 기간 대비 증감. 돈은 같은 통화끼리만 비교하고, 같은 통화의 직전 값이 없으면 증감을 내지 않는다(`unavailable`) */
export function deltaOf(metric: DashboardMetric, compare: boolean): Delta {
  if (!compare) return { kind: 'off' }
  const current = metric.value?.[0]
  if (metric.status !== 'OK' || !current || !metric.previousValue) return { kind: 'unavailable' }
  // 같은 통화의 직전 값만 비교한다 - 다른 통화(KRW 이번 vs USD 직전)와 견주지 않는다
  const previous = metric.previousValue.find((v) => v.currency === current.currency)
  if (!previous) return { kind: 'unavailable' }
  if (previous.amount === 0)
    return current.amount === 0 ? { kind: 'flat', percent: 0 } : { kind: 'new' }
  const percent = Math.round(((current.amount - previous.amount) / previous.amount) * 1000) / 10
  if (percent === 0) return { kind: 'flat', percent: 0 }
  return percent > 0 ? { kind: 'up', percent } : { kind: 'down', percent: Math.abs(percent) }
}

/** 퍼센트 한 자리 — `12.4%` */
export function formatPercent(value: number, locale?: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`
}

/** 그래프 눈금 · 툴팁의 시각 — 시간별이면 「14:00」, 일별이면 「10/26」, 주별이면 「10/26~」 */
export function formatPointLabel(
  at: string,
  interval: DashboardInterval,
  zone: string,
  locale?: string,
): string {
  const options: Intl.DateTimeFormatOptions =
    interval === 'HOUR'
      ? { hour: 'numeric', minute: '2-digit', hour12: false }
      : { month: 'numeric', day: 'numeric' }
  const text = new Intl.DateTimeFormat(locale, { timeZone: zone, ...options }).format(new Date(at))
  return interval === 'WEEK' ? `${text}~` : text
}

/**
 * 국가 코드(`KR`)를 보는 사람의 언어 이름(「대한민국」 · `South Korea`)으로. Cloudflare 는 ISO 국가 코드를 준다.
 * 코드가 아니거나(`T1` 토르 · `XX` 알 수 없음 - 이름이 코드 그대로 돌아온다) 모르는 코드면 코드 그대로, GA 처럼 이미 이름이면 그대로
 */
export function regionLabel(code: string, locale?: string): string {
  if (!/^([A-Za-z]{2}|\d{3})$/.test(code)) return code
  try {
    const name = new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'region' }).of(
      code.toUpperCase(),
    )
    return name && name !== code.toUpperCase() ? name : code
  } catch {
    return code
  }
}

/** 갱신 시각 한 줄 — 짧게(`10/26 14:00`) */
export function formatAsOf(iso: string, zone: string, locale?: string): string {
  return formatInstant(iso, { zone, locale, dateStyle: 'short', timeStyle: 'short' })
}
