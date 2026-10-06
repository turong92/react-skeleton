/**
 * 몇 번 늦게 다시 읽는다 — 백엔드는 이메일 변경 요청(202)을 받고 토큰 · 메일을 다른 스레드에서 만든다. 그래서 바로 뒤의 `GET /account/me` 에는 아직
 * `pendingEmail` 이 없고 잠시 뒤에 생긴다. `done()` 이 참이면(대기 상태가 보이면) 멈추고, 반환한 함수로 취소한다.
 * (남의 주소로 요청했으면 끝내 안 생긴다 — 존재 여부를 숨기는 서버의 설계이므로 정해진 횟수만 읽고 그만둔다)
 */
export function reloadLater(
  reload: () => void,
  delaysMs: number[],
  done: () => boolean = () => false,
): () => void {
  const timers = delaysMs.map((delay) =>
    setTimeout(() => {
      if (!done()) reload()
    }, delay),
  )
  return () => timers.forEach(clearTimeout)
}
