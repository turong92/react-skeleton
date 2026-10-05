const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 실제로 있는 달력 날짜인가(`2026-02-30` 은 아니다) */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/** `YYYY-MM-DD` 는 글자 순서가 날짜 순서라 문자열 비교로 충분하다 */
export function clampDate(value: string, min?: string, max?: string): string {
  if (!value) return value
  if (min && value < min) return min
  if (max && value > max) return max
  return value
}

/** 기간의 문제 — 끝이 시작보다 앞이면 `order`. 한쪽이 비었거나 날짜가 아니면 아직 판단하지 않는다 */
export function rangeProblem(start: string, end: string): 'order' | null {
  return isIsoDate(start) && isIsoDate(end) && end < start ? 'order' : null
}
