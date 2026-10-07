/*
 * 일회용 토큰 · 인가 코드를 자동으로 보내는 호출을 키(토큰)마다 **모듈 수준에서 한 번만** 보내고 결과(성공 · 실패)를 나눠 쓴다.
 * 컴포넌트의 ref 로는 막을 수 없는 경우가 있다 — StrictMode 의 이중 효과는 ref 가 이어져 막히지만, 로그인되는 순간 위쪽(동의 게이트 · 라우트 가드)이
 * 화면을 **새 인스턴스로 다시 마운트**하면 ref 가 새것이라 같은 토큰으로 또 불러 두 번째가 410 이 된다(실측: `POST /auth/magic-link/redeem` 200 → 410).
 * 항목은 1분 뒤에 잊는다(다른 링크는 다른 토큰이다).
 */
const RETAIN_MS = 60_000
const calls = new Map<string, Promise<unknown>>()

export function runOnce<T>(key: string, call: () => Promise<T>): Promise<T> {
  const known = calls.get(key)
  if (known) return known as Promise<T>
  const started = call()
  calls.set(key, started)
  setTimeout(() => calls.delete(key), RETAIN_MS)
  return started
}
