import type { TurnstileApi, TurnstileRenderOptions } from '../types'

/** Cloudflare 스크립트 대신 `loader` 로 끼우는 가짜 — `solve()` 가 사람이 위젯을 푼 것처럼 토큰을 준다 */
export function createFakeTurnstile() {
  const token = 'fake-turnstile-token'
  let current: TurnstileRenderOptions | undefined
  const api: TurnstileApi = {
    render: (_container, options) => {
      current = options
      return 'fake-widget'
    },
    reset: () => undefined,
    remove: () => {
      current = undefined
    },
  }
  return {
    token,
    loader: async () => api,
    solve: () => current?.callback?.(token),
    expire: () => current?.['expired-callback']?.(),
  }
}
