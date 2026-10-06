/** `window` 의 필요한 부분 — 테스트는 가짜를 준다 */
export type UrlHost = {
  location: { pathname: string; search: string; hash: string }
  history: { state: unknown; replaceState(state: unknown, title: string, url: string): void }
}

function without(raw: string, prefix: '?' | '#', keys: readonly string[]): string {
  const params = new URLSearchParams(raw.replace(/^[?#]/, ''))
  let changed = false
  for (const key of keys)
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  if (!changed) return raw
  const rest = params.toString()
  return rest ? `${prefix}${rest}` : ''
}

/**
 * 일회용 토큰 · OAuth 코드를 읽은 뒤 주소창과 히스토리 항목에서 지운다(`history.replaceState`) — 어깨너머로 보이거나 뒤로 가기 · 공유 · 북마크로
 * 새지 않게. 라우터의 상태(`history.state`)는 그대로 둔다. 서버(`window` 없음)에서는 아무것도 안 한다. 이미 읽은 값은 화면의 메모리에 있다.
 */
export function scrubUrlParams(
  keys: readonly string[],
  host: UrlHost | undefined = typeof window === 'undefined' ? undefined : window,
): void {
  if (!host) return
  const { pathname, search, hash } = host.location
  const nextSearch = without(search, '?', keys)
  const nextHash = without(hash, '#', keys)
  if (nextSearch === search && nextHash === hash) return
  host.history.replaceState(host.history.state, '', `${pathname}${nextSearch}${nextHash}`)
}
