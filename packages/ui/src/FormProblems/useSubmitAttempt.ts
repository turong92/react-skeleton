import { useCallback, useEffect, useRef, useState } from 'react'
import { revealControl } from './revealControl'

/**
 * 「제출을 눌렀는데 비어 · 틀려 못 보냈다」를 기억한다 — 화면은 `attempted` 가 true 가 된 뒤부터 틀린 곳을 보이고(고치면 곧바로 사라진다),
 * `fail(첫 틀린 칸의 id)` 를 부르면 그 칸으로 포커스 · 스크롤이 간다(렌더 뒤에 — `aria-invalid` 가 칠해진 다음).
 * 서버 응답으로 성공하면 `reset()`.
 */
export function useSubmitAttempt() {
  const [attempts, setAttempts] = useState(0)
  const target = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (attempts > 0) revealControl(target.current)
  }, [attempts])
  const fail = useCallback((firstTarget?: string) => {
    target.current = firstTarget
    setAttempts((n) => n + 1)
  }, [])
  const reset = useCallback(() => setAttempts(0), [])
  return { attempted: attempts > 0, fail, reset }
}
