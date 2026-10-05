import { useCallback, useMemo, useRef, useState } from 'react'
import type { TurnstileHandle } from './Turnstile'

/**
 * 위젯이 준 토큰을 들고 있는다 — `const captcha = useTurnstileToken()`, `<Turnstile siteKey={…} {...captcha.widgetProps} />`,
 * 제출 때 `attachTurnstileToken(body, captcha.token)`, 제출이 실패하면 `captcha.reset()`(토큰은 한 번만 쓰인다).
 * `captcha.token` 이 `null` 인 동안은 제출 버튼을 막는다.
 */
export function useTurnstileToken() {
  const [token, setToken] = useState<string | null>(null)
  const ref = useRef<TurnstileHandle>(null)
  const reset = useCallback(() => {
    setToken(null)
    ref.current?.reset()
  }, [])
  const widgetProps = useMemo(
    () => ({ ref, onToken: setToken, onExpire: () => setToken(null) }),
    [],
  )
  return { token, reset, widgetProps }
}
