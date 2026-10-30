/** 별 하나하나가 얼마나 찼는지(0~1, 소수 한 자리) — 4.3 이면 `[1, 1, 1, 1, 0.3]` */
export function starFills(value: number, max = 5): number[] {
  const clamped = Math.min(Math.max(value, 0), max)
  return Array.from(
    { length: max },
    (_, index) => Math.round(Math.min(Math.max(clamped - index, 0), 1) * 10) / 10,
  )
}

/** 평균은 서버가 소수 한 자리로 준다 - 보이는 숫자도 늘 한 자리(4 → 4.0) */
export function formatAverage(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}
