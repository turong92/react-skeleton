/** 다른 탭의 저장소 변경을 듣는 자리 — 브라우저에서는 `window`(`storage` 이벤트), 테스트에서는 가짜를 꽂는다 */
export type StorageEventSource = {
  addEventListener(type: 'storage', listener: (event: { key: string | null }) => void): void
  removeEventListener(type: 'storage', listener: (event: { key: string | null }) => void): void
}

export type CrossTabOption = boolean | { events?: StorageEventSource }

/**
 * `crossTab` 옵션을 풀어 `key` 가 바뀌었을 때(또는 `localStorage.clear()` 의 key=null) `onChange` 를 부른다.
 * 서버(window 없음)이거나 이벤트 원천이 없으면 아무것도 하지 않는다 — import 할 때가 아니라 저장소를 만들 때만 닿는다.
 */
export function listenToOtherTabs(
  option: CrossTabOption | undefined,
  key: string,
  onChange: () => void,
): void {
  if (!option) return
  const source: StorageEventSource | undefined =
    typeof option === 'object' && option.events
      ? option.events
      : typeof window !== 'undefined'
        ? window
        : undefined
  source?.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) onChange()
  })
}
