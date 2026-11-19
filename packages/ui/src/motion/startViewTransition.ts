import { prefersReducedMotion } from './prefersReducedMotion'

/**
 * 화면 전환(View Transitions API)을 얇게 감싼다 — `update` 가 DOM 을 바꾸는 동안 브라우저가 전과 후를 이어 준다.
 * API 가 없는 브라우저 · 움직임 줄이기 설정이면 전환 없이 `update` 만 실행한다. 전환이 끝나면(없으면 `update` 가 끝나면) resolve
 * 공유 요소 전환은 두 화면의 요소에 같은 `view-transition-name` 을 CSS 로 준다
 */
export async function startViewTransition(update: () => void | Promise<void>): Promise<void> {
  const start = typeof document !== 'undefined' ? document.startViewTransition : undefined
  if (!start || prefersReducedMotion()) {
    await update()
    return
  }
  await start.call(document, update).finished
}
