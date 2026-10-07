/**
 * 선택기로 포커스 — 떠 있는 질문(`data-author-notice`)이 있으면 그 안의 첫 조작 요소, 없으면 선택기의 첫 조작 요소. 못 찾으면 아무것도 하지 않는다
 */
export function focusAuthorSlot(form: HTMLFormElement) {
  const focusable =
    ':is(button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])):not(:disabled)'
  const target =
    form.querySelector<HTMLElement>(`[data-author-slot] [data-author-notice] ${focusable}`) ??
    form.querySelector<HTMLElement>(`[data-author-slot] ${focusable}`)
  target?.focus()
}
