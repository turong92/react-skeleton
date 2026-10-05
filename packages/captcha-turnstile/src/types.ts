/** `window.turnstile` 중 쓰는 부분(Cloudflare Turnstile 명시적 렌더링 API) */
export type TurnstileApi = {
  render(container: string | HTMLElement, options: TurnstileRenderOptions): string | undefined
  reset(widgetId?: string): void
  remove(widgetId?: string): void
}

/** `turnstile.render` 옵션 중 쓰는 부분 — 키 이름은 Cloudflare 위젯의 것 */
export type TurnstileRenderOptions = {
  sitekey: string
  /** 백엔드 `skeleton.captcha-turnstile.expected-action` 이 있으면 같은 값 */
  action?: string
  cData?: string
  theme?: 'auto' | 'light' | 'dark'
  size?: 'normal' | 'flexible' | 'compact'
  appearance?: 'always' | 'execute' | 'interaction-only'
  language?: string
  callback?: (token: string) => void
  'expired-callback'?: () => void
  /** `true` 를 돌려주면 위젯이 콘솔 경고를 내지 않는다 */
  'error-callback'?: (errorCode: string) => boolean | void
}
