import { useCallback, useEffect, useState } from 'react'
import { secondsLeft } from './errors'

/**
 * 1초마다 줄어드는 남은 초. `start(seconds)` 로 시작하고 0 이 되면 멈춘다 — 「n 초 뒤에 다시 보내기」 · 429 `Retry-After` 에 쓴다.
 * 시계는 `Date.now()` 라 탭이 잠들었다 깨도 맞는다.
 */
export function useCountdown(): { seconds: number; start: (seconds: number) => void } {
  const [until, setUntil] = useState(0)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (until === 0) return
    const tick = () => {
      const left = secondsLeft(until, Date.now())
      setSeconds(left)
      if (left === 0) setUntil(0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [until])
  const start = useCallback((s: number) => setUntil(s > 0 ? Date.now() + s * 1000 : 0), [])
  return { seconds, start }
}
