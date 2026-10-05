export type PaginationItem = number | 'gap'

/**
 * 쪽 번호 줄 — 처음 · 끝 · 현재 쪽과 양옆 `siblings` 쪽을 보이고 사이가 비면 `'gap'`(한 쪽뿐이면 그 쪽을 그대로).
 * 쪽 번호는 백엔드 `PaginationMeta.page` 처럼 0 부터. 범위를 벗어난 현재 쪽은 끝으로 맞춘다.
 */
export function paginationItems(page: number, totalPages: number, siblings = 1): PaginationItem[] {
  if (totalPages <= 0) return []
  const last = totalPages - 1
  const current = Math.min(Math.max(page, 0), last)
  const wanted = new Set([0, last])
  for (let n = current - siblings; n <= current + siblings; n += 1)
    if (n >= 0 && n <= last) wanted.add(n)
  const pages = [...wanted].sort((a, b) => a - b)
  const items: PaginationItem[] = []
  pages.forEach((n, index) => {
    const before = pages[index - 1]
    if (before !== undefined && n - before === 2) items.push(before + 1)
    else if (before !== undefined && n - before > 2) items.push('gap')
    items.push(n)
  })
  return items
}
