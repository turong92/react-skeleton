import type { TurnstileApi } from './types'

/** 명시적 렌더링 모드(`render=explicit`) — 자동 렌더링은 React 가 만든 DOM 과 맞지 않는다 */
export const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export type TurnstileLoaderEnv = {
  /** 스크립트 주소(프록시 · 테스트). 기본 {@link TURNSTILE_SCRIPT_SRC} */
  src?: string
  window?: { turnstile?: TurnstileApi }
  document?: Pick<Document, 'createElement'> & { head: { appendChild(node: unknown): unknown } }
}

// window 마다 따로 기억한다 — 한 페이지에 스크립트는 한 번만 붙는다
const loading = new WeakMap<object, Map<string, Promise<TurnstileApi>>>()

/**
 * Turnstile 스크립트를 한 번만 불러 `window.turnstile` 을 돌려준다. 이미 있으면 바로, 로드 중이면 같은 약속,
 * 실패하면 다음 호출이 다시 시도한다. 브라우저가 아니면(서버 렌더) 거절한다. `env` 로 `window` · `document` 를 바꿔 끼울 수 있다(테스트).
 */
export function loadTurnstile(env: TurnstileLoaderEnv = {}): Promise<TurnstileApi> {
  const win: TurnstileLoaderEnv['window'] =
    'window' in env ? env.window : (globalThis as { window?: TurnstileLoaderEnv['window'] }).window
  const doc: TurnstileLoaderEnv['document'] =
    'document' in env
      ? env.document
      : (globalThis as { document?: TurnstileLoaderEnv['document'] }).document
  if (!win || !doc)
    return Promise.reject(new Error('Turnstile needs a browser (no window/document)'))
  if (win.turnstile) return Promise.resolve(win.turnstile)

  const src = env.src ?? TURNSTILE_SCRIPT_SRC
  const bySrc = loading.get(win) ?? new Map<string, Promise<TurnstileApi>>()
  loading.set(win, bySrc)
  const known = bySrc.get(src)
  if (known) return known

  const promise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = doc.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    const fail = (why: string) => {
      bySrc.delete(src)
      reject(new Error(`Failed to load the Turnstile script: ${why}`))
    }
    script.onload = () => {
      if (win.turnstile) resolve(win.turnstile)
      else fail('window.turnstile is missing after load')
    }
    script.onerror = () => fail(`could not fetch ${src} (blocked or offline?)`)
    doc.head.appendChild(script)
  })
  bySrc.set(src, promise)
  return promise
}
