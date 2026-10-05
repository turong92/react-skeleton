import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { createTurnstileWidget, type TurnstileWidget } from './widget'
import type { TurnstileApi, TurnstileRenderOptions } from './types'

export type TurnstileHandle = {
  /** 새 토큰을 받는다(토큰은 한 번만 쓰인다 — 제출이 실패하면 부른다) */
  reset(): void
}

export type TurnstileProps = Pick<
  TurnstileRenderOptions,
  'action' | 'cData' | 'theme' | 'size' | 'appearance' | 'language'
> & {
  /** 공개값(위젯 사이트 키). 비밀 키는 백엔드 `skeleton.captcha-turnstile.secret-key` 에만 있다 */
  siteKey: string
  onToken: (token: string) => void
  onExpire?: () => void
  onError?: (code: string) => void
  className?: string
  /** 스크립트를 불러오는 함수(기본 `loadTurnstile`). 처음 값으로 고정되지 않는다 — 바뀌면 위젯을 다시 만든다 */
  loader?: () => Promise<TurnstileApi>
  /** `useRef<TurnstileHandle>` — `reset()` 용 */
  ref?: Ref<TurnstileHandle>
}

/**
 * Cloudflare Turnstile 위젯. 마운트하면 스크립트를 불러(한 번만) 그린다. 토큰이 나오면 `onToken`,
 * 만료되면 `onExpire`. 서버 렌더에서는 빈 상자만 낸다. `siteKey` · `action` · `theme` 등이 바뀌면 위젯을 다시 만든다.
 * 콜백(`onToken` …)은 최신 것이 불리므로 바뀌어도 다시 만들지 않는다.
 */
export function Turnstile({
  siteKey,
  onToken,
  onExpire,
  onError,
  action,
  cData,
  theme,
  size,
  appearance,
  language,
  className,
  loader,
  ref,
}: TurnstileProps) {
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<TurnstileWidget | null>(null)
  const handlers = useRef({ onToken, onExpire, onError })
  useEffect(() => {
    handlers.current = { onToken, onExpire, onError }
  })

  useEffect(() => {
    if (!container.current) return
    const created = createTurnstileWidget({
      container: container.current,
      siteKey,
      action,
      cData,
      theme,
      size,
      appearance,
      language,
      loader,
      onToken: (token) => handlers.current.onToken(token),
      onExpire: () => handlers.current.onExpire?.(),
      onError: (code) => handlers.current.onError?.(code),
    })
    widget.current = created
    return () => {
      created.destroy()
      widget.current = null
    }
  }, [siteKey, action, cData, theme, size, appearance, language, loader])

  useImperativeHandle(ref, () => ({ reset: () => widget.current?.reset() }), [])

  return <div ref={container} className={className} data-turnstile="" />
}
