/** 배지 글자 — 0 이면 없음(null), `max` 를 넘으면 `99+` */
export function badgeText(count: number, max = 99): string | null {
  if (count <= 0) return null
  return count > max ? `${max}+` : String(count)
}
