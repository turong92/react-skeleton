import { loadTurnstile } from './loader'
import type { TurnstileApi, TurnstileRenderOptions } from './types'

export type TurnstileWidgetOptions = Omit<
  TurnstileRenderOptions,
  'sitekey' | 'callback' | 'expired-callback' | 'error-callback'
> & {
  container: HTMLElement
  siteKey: string
  /** 검증 토큰이 나왔을 때 — 이 값을 요청에 붙인다(`attachTurnstileToken`) */
  onToken: (token: string) => void
  /** 토큰이 만료됐을 때(그동안 제출하지 않았다) — 토큰을 버린다 */
  onExpire?: () => void
  /** 위젯 오류 코드, 또는 스크립트를 못 불렀을 때 `script-load-failed` */
  onError?: (code: string) => void
  /** 스크립트를 불러오는 함수(기본 `loadTurnstile`) — 테스트에서 바꾼다 */
  loader?: () => Promise<TurnstileApi>
}

export type TurnstileWidget = {
  /** 새 토큰을 받는다. 토큰은 한 번만 쓰이므로 제출이 실패했으면 부른다 */
  reset(): void
  destroy(): void
}

/** 위젯 하나의 수명 — 스크립트 로드 → render → (reset) → remove. React 를 모른다(`<Turnstile>` 이 effect 로 감싼다) */
export function createTurnstileWidget({
  container,
  siteKey,
  onToken,
  onExpire,
  onError,
  loader = () => loadTurnstile(),
  ...renderOptions
}: TurnstileWidgetOptions): TurnstileWidget {
  let destroyed = false
  let api: TurnstileApi | undefined
  let id: string | undefined

  loader().then(
    (loaded) => {
      if (destroyed) return
      api = loaded
      id = loaded.render(container, {
        ...renderOptions,
        sitekey: siteKey,
        callback: (token) => {
          if (!destroyed) onToken(token)
        },
        'expired-callback': () => {
          if (!destroyed) onExpire?.()
        },
        'error-callback': (code) => {
          if (!destroyed) onError?.(code)
          return true
        },
      })
    },
    () => {
      if (!destroyed) onError?.('script-load-failed')
    },
  )

  return {
    reset() {
      if (!destroyed && api && id !== undefined) api.reset(id)
    },
    destroy() {
      destroyed = true
      if (api && id !== undefined) api.remove(id)
    },
  }
}
