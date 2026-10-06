import { useCallback, useEffect, useMemo, useState } from 'react'

type Settled<T> = { request: unknown; data?: T; error?: unknown }

/**
 * 불러오기 한 건의 상태 — 화면이 TanStack Query 없이 쓰는 가장 작은 모양(패키지는 서버 상태 라이브러리에 묶이지 않는다).
 * `load` 가 바뀌거나 `reload()` 를 부르면 다시 불러오고, 그동안 직전 `data` 는 남는다(깜박임 없음). `load` 는 호출자가 `useCallback` 으로 안정시킨다.
 */
export function useResource<T>(load: () => Promise<T>) {
  const [tick, setTick] = useState(0)
  const request = useMemo(() => ({}), [load, tick]) // eslint-disable-line react-hooks/exhaustive-deps -- 새 요청의 정체성
  const [settled, setSettled] = useState<Settled<T>>({ request: null })
  useEffect(() => {
    let active = true
    load().then(
      (data) => active && setSettled({ request, data }),
      (error: unknown) => active && setSettled({ request, error }),
    )
    return () => {
      active = false
    }
  }, [load, request])
  const reload = useCallback(() => setTick((n) => n + 1), [])
  return {
    data: settled.data,
    error: settled.error ?? null,
    loading: settled.request !== request,
    reload,
  }
}
