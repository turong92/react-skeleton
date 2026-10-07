/** 선택기 안의 첫 조작 요소로 포커스 — 못 찾으면 아무것도 하지 않는다 */
export function focusAuthorSlot(form: HTMLFormElement) {
  form
    .querySelector<HTMLElement>(
      '[data-author-slot] :is(button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])):not(:disabled)',
    )
    ?.focus()
}
