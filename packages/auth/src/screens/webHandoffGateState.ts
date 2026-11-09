/**
 * 문지기의 단계. `pending` = 아직 주소를 읽지 않았다(서버 · 하이드레이션 중) → 아무것도 그리지 않는다. `open` = 문을 열었다(children). `confirm` = 이미 다른 계정으로 로그인해 있다 →
 * 「지금 계정에서 나갈까요?」. `redeem` = 코드를 바꾸는 중(또는 실패 안내). `anchor` = 이 화면이 시작된 경로 - 화면의 링크 · 이동으로 경로가 바뀌면 문을 연다.
 */
export type GatePhase =
  | { kind: 'pending' }
  | { kind: 'open' }
  | { kind: 'confirm'; code: string; anchor: string }
  | { kind: 'redeem'; code: string; anchor: string }

export type GateEvent =
  | { type: 'read'; code: string | null; signedIn: boolean; path: string }
  | { type: 'confirmed' }
  | { type: 'cancelled' }
  | { type: 'signedIn' }
  | { type: 'moved'; path: string }

export function gateReducer(state: GatePhase, event: GateEvent): GatePhase {
  switch (event.type) {
    case 'read':
      if (state.kind !== 'pending') return state
      if (!event.code) return { kind: 'open' }
      // 이미 로그인해 있으면 묻는다 - 공격자가 만든 코드 링크로 피해자의 브라우저를 공격자 계정에 로그인시키는 일(login CSRF)을 사람이 막는다. 코드에는 계정이 안 보여 늘 묻는다
      return event.signedIn
        ? { kind: 'confirm', code: event.code, anchor: event.path }
        : { kind: 'redeem', code: event.code, anchor: event.path }
    case 'confirmed':
      return state.kind === 'confirm'
        ? { kind: 'redeem', code: state.code, anchor: state.anchor }
        : state
    case 'cancelled':
    case 'signedIn':
      return state.kind === 'pending' ? state : { kind: 'open' }
    case 'moved':
      // 실패 안내의 「로그인」 링크 · 2단계 화면으로의 이동 - 화면이 놓아 줘야 새 라우트가 그려진다
      return (state.kind === 'confirm' || state.kind === 'redeem') && event.path !== state.anchor
        ? { kind: 'open' }
        : state
  }
}

/**
 * 주소에 `handoff` 가 있으면(조각이든 쿼리든) 그것만 뗀 다음 위치를, 없으면 null. 라우터의 `navigate(…, { replace: true })` 로 지운다 - 브라우저 히스토리 항목만 고치면 라우터가 쥔
 * 위치(→ `RequireAuth` 가 로그인 화면에 실어 보내는 `state.from` · 로그인 뒤 돌아갈 곳)에는 코드가 남는다.
 */
export function withoutHandoff(location: {
  pathname: string
  search: string
  hash: string
}): { pathname: string; search: string; hash: string } | null {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(location.search.replace(/^\?/, ''))
  if (!fragment.has('handoff') && !query.has('handoff')) return null
  fragment.delete('handoff')
  query.delete('handoff')
  const search = query.toString()
  const hash = fragment.toString()
  return {
    pathname: location.pathname,
    search: search ? `?${search}` : '',
    hash: hash ? `#${hash}` : '',
  }
}
