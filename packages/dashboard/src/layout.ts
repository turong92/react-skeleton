import type { DashboardLayout } from './types'

/** 화면 설정의 카드 키: 묶음 순위 `rankings.<group>` · `returning`(재방문율) · `funnel` · `app`(앱 통계). 맨 위 타일 줄 `tiles` 와 그래프 `chart` 는 늘 맨 앞에 있고 옮기지 않는다 */
export const FIXED_CARDS = ['tiles', 'chart'] as const

export const DEFAULT_LAYOUT: DashboardLayout = { hidden: [], order: [] }

const GROUP_ORDER = ['traffic', 'pages', 'geo']

/** 개요에 실제로 있는 카드의 키 - 기본 순서(유입 · 페이지 · 지역 · 그 밖의 묶음 · 퍼널 · 앱 통계) */
export function availableCards(
  groups: readonly string[],
  hasFunnel: boolean,
  hasReturning = false,
): string[] {
  const others = groups.filter((g) => g !== 'app' && !GROUP_ORDER.includes(g))
  return [
    ...GROUP_ORDER.filter((g) => groups.includes(g)).map((g) => `rankings.${g}`),
    ...others.map((g) => `rankings.${g}`),
    ...(hasReturning ? ['returning'] : []),
    ...(hasFunnel ? ['funnel'] : []),
    ...(groups.includes('app') ? ['app'] : []),
  ]
}

/** 저장된 순서를 따르되 지금 없는 카드는 빼고, 저장에 없던 새 카드는 기본 순서대로 뒤에 붙인다 */
export function orderedCards(available: readonly string[], saved: readonly string[]): string[] {
  const known = saved.filter((key, i) => available.includes(key) && saved.indexOf(key) === i)
  return [...known, ...available.filter((key) => !known.includes(key))]
}

/** 카드 하나를 `delta`(−1 앞 · +1 뒤)만큼 옮긴다. 끝이면 그대로 */
export function moveCard(order: readonly string[], key: string, delta: number): string[] {
  const from = order.indexOf(key)
  const to = from + delta
  if (from < 0 || to < 0 || to >= order.length) return [...order]
  const next = [...order]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

/** 끌어 놓기 - `key` 를 `target` 이 있던 자리로 */
export function dropCard(order: readonly string[], key: string, target: string): string[] {
  const from = order.indexOf(key)
  const to = order.indexOf(target)
  if (from < 0 || to < 0 || from === to) return [...order]
  const next = order.filter((k) => k !== key)
  next.splice(to, 0, key)
  return next
}

export function toggleHidden(hidden: readonly string[], key: string): string[] {
  return hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]
}

/** 서버 · 브라우저에 저장하는 꼴 - 맨 앞 고정 카드를 앞세운다 */
export function layoutToSave(order: readonly string[], hidden: readonly string[]): DashboardLayout {
  return { hidden: [...hidden], order: [...FIXED_CARDS, ...order] }
}

/** 브라우저에 저장된 값(믿을 수 없다)을 읽는다 - 문자열 배열이 아니면 기본 */
export function parseLayout(raw: string | null): DashboardLayout {
  if (!raw) return DEFAULT_LAYOUT
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return DEFAULT_LAYOUT
    const { hidden, order } = value as Record<string, unknown>
    const strings = (list: unknown) =>
      Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
    return { hidden: strings(hidden), order: strings(order) }
  } catch {
    return DEFAULT_LAYOUT
  }
}
