/** 403 로 호출을 붙잡는 막(이메일 등록 · 약관 재동의)의 컨트롤러가 공통으로 가진 부분 */
type Gate = { getState(): { status: string }; subscribe(listener: () => void): () => void }

/**
 * 막이 **걷히는 순간**(`required` → `idle`: 등록 · 동의 · 다른 탭에서 끝났다)마다 `onRelease` 를 부른다. 열릴 때나 그대로일 때는 부르지 않는다.
 * 막이 열린 동안 403 을 받고 멈춘 스트림(`/notifications/sse`)이 이 신호로 다시 이어진다 — 토큰이 바뀌지 않는 이유로 풀린 403 이라 `subscribeAuthChanges` 만으로는 깨어나지 못한다.
 */
export function subscribeGateRelease(gates: Gate[], onRelease: () => void): () => void {
  const offs = gates.map((gate) => {
    let open = gate.getState().status === 'required'
    return gate.subscribe(() => {
      const nowOpen = gate.getState().status === 'required'
      if (open && !nowOpen) onRelease()
      open = nowOpen
    })
  })
  return () => offs.forEach((off) => off())
}
