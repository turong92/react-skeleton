import { useCallback, useState } from 'react'
import { authErrorMessage, type AuthErrorInfo } from './errors'
import type { AuthLabels } from './labels'

/** 버튼 하나의 「진행 중 · 실패 문구」 — 성공이면 true. 실패는 던지지 않고 `error` 에 담는다 */
export function useAction(labels: AuthLabels) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthErrorInfo | null>(null)
  const [error_raw, setRaw] = useState<unknown>(null)
  const run = useCallback(
    async (task: () => Promise<unknown>): Promise<boolean> => {
      setBusy(true)
      setError(null)
      setRaw(null)
      try {
        await task()
        return true
      } catch (caught) {
        setError(authErrorMessage(caught, labels))
        setRaw(caught)
        return false
      } finally {
        setBusy(false)
      }
    },
    [labels],
  )
  const clear = useCallback(() => {
    setError(null)
    setRaw(null)
  }, [])
  return { busy, error, raw: error_raw, run, clear }
}
