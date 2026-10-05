export type TabKeyItem = { id: string; disabled?: boolean }

/**
 * 탭 목록의 화살표 이동(WAI-ARIA tabs 패턴) — 이동할 탭의 id, 이동 키가 아니면 `null`.
 * 가로: ← → · 세로: ↑ ↓ · Home/End 는 처음/끝. 비활성 탭은 건너뛰고 끝에서 돌아온다.
 */
export function nextTabId(
  items: readonly TabKeyItem[],
  currentId: string,
  key: string,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
): string | null {
  const enabled = items.filter((item) => !item.disabled)
  if (enabled.length === 0) return null
  const forward = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
  const backward = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
  if (key === 'Home') return enabled[0].id
  if (key === 'End') return enabled[enabled.length - 1].id
  if (key !== forward && key !== backward) return null
  const at = enabled.findIndex((item) => item.id === currentId)
  if (at < 0) return enabled[0].id
  const step = key === forward ? 1 : -1
  return enabled[(at + step + enabled.length) % enabled.length].id
}
