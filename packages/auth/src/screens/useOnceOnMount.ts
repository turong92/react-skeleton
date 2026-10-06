import { useEffect, useRef } from 'react'

/**
 * 마운트 때 딱 한 번 실행하고 결과를 받는다. React StrictMode 는 개발에서 effect 를 두 번 돌리는데, 일회용 토큰 호출(인증 · 로그인 링크)이
 * 두 번 나가면 두 번째가 410 이 된다 — 그래서 호출은 한 번만, 결과 반영은 지금 마운트된 쪽에만 한다.
 */
export function useOnceOnMount<T>(
  run: () => Promise<T>,
  onSettled: (outcome: { ok: true; value: T } | { ok: false; error: unknown }) => void,
) {
  const started = useRef(false)
  const mounted = useRef(false)
  const latest = useRef(onSettled)
  useEffect(() => {
    latest.current = onSettled
  })
  useEffect(() => {
    mounted.current = true
    if (!started.current) {
      started.current = true
      run().then(
        (value) => mounted.current && latest.current({ ok: true, value }),
        (error: unknown) => mounted.current && latest.current({ ok: false, error }),
      )
    }
    return () => {
      mounted.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 한 번만
  }, [])
}
