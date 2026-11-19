/** 통화 최소 단위 정수 → 사람이 읽는 금액. 통화가 없으면(무료 풀) 숫자만 */
export function formatMoney(amount: number, currency: string | undefined, locale?: string): string {
  if (!currency) return String(amount)
  try {
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency })
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 0
    return formatter.format(amount / 10 ** digits)
  } catch {
    return `${amount} ${currency}`
  }
}

/** `1:02:03` 꼴(분:초만 필요하면 `0:` 으로 시작) */
export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`
}

const collator = new Intl.Collator(undefined, { numeric: true })
export const naturalCompare = (a: string, b: string) => collator.compare(a, b)
