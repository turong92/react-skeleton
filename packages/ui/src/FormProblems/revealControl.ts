const CONTROLS = 'input, select, textarea, button, [tabindex]'

const isControl = (element: Element) => element.matches(CONTROLS)

/** 감싸는 상자를 받으면 그 안의 첫 「틀린」 칸(`aria-invalid`), 없으면 첫 칸. 칸이면 그대로 */
function controlIn(element: HTMLElement): HTMLElement {
  if (isControl(element)) return element
  return (
    element.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    element.querySelector<HTMLElement>(CONTROLS) ??
    element
  )
}

/**
 * 틀린 칸으로 데려간다 — 포커스를 옮기고 화면 안으로 스크롤한다(움직임 줄이기 설정이면 부드럽게 스크롤하지 않는다).
 * `target` 은 칸의 `id`(또는 칸을 감싼 상자의 `id` — 그 안의 첫 틀린 칸으로 간다). 찾지 못하면 false.
 * 화면 아래에 떠 있는 것(동의 배너)은 `html { scroll-padding-bottom }` 으로 비켜 선다(`@skeleton/marketing` 의 배너가 설정한다).
 */
export function revealControl(target: string | HTMLElement | null | undefined): boolean {
  if (typeof document === 'undefined' || !target) return false
  const found = typeof target === 'string' ? document.getElementById(target) : target
  if (!found) return false
  const control = controlIn(found)
  control.focus({ preventScroll: true })
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  control.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  return true
}
