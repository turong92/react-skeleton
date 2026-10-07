/*
 * 일회용 토큰 · 인가 코드를 자동으로 보내는 호출을 키(종류 접두사 + 토큰)마다 **한 번만** 보낸다. 컴포넌트의 ref 로는 막을 수 없는 경우가 있다 —
 * 로그인되는 순간 위쪽(동의 게이트 · 라우트 가드)이 화면을 **새 인스턴스로 다시 마운트**하면 ref 가 새것이라 같은 토큰으로 또 불러 두 번째가 410 이 된다
 * (실측: `POST /auth/magic-link/redeem` 200 → 410).
 *
 * 상태는 모듈 전역이 아니라 이 함수를 만든 쪽(`createAuthRoutes` 한 벌)이 쥔다. 결과를 쥐지 않는다:
 * 진행 중인 호출은 겹친 호출자가 같은 약속(결과 · 오류)을 나눠 쓰고, 끝나면 **성공은 완료 표시만**(값은 버린다 — 토큰 응답을 붙들지 않는다 · 호출부는 세션 상태로 판단) 1분,
 * **실패는 바로 잊는다**(일시적인 네트워크 실패는 다시 보낼 수 있고, 거절(4xx)은 서버가 같은 답을 한다 — 오류 안의 `restoreToken` 도 쥐지 않는다).
 */
const RETAIN_MS = 60_000

export type OnceRunner = <T>(key: string, call: () => Promise<T>) => Promise<T | undefined>

export function createOnceRunner(): OnceRunner {
  const entries = new Map<
    string,
    { state: 'pending'; promise: Promise<unknown> } | { state: 'done' }
  >()
  return function once<T>(key: string, call: () => Promise<T>): Promise<T | undefined> {
    const known = entries.get(key)
    if (known?.state === 'pending') return known.promise as Promise<T>
    if (known?.state === 'done') return Promise.resolve(undefined)
    const promise = call().then(
      (value) => {
        entries.set(key, { state: 'done' })
        setTimeout(() => entries.delete(key), RETAIN_MS)
        return value
      },
      (error: unknown) => {
        entries.delete(key)
        throw error
      },
    )
    entries.set(key, { state: 'pending', promise })
    return promise
  }
}
