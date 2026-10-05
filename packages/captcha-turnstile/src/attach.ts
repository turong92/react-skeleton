/*
 * 백엔드 `TurnstileVerifier.verify(token)`(modules/captcha-turnstile)이 받는 값은 위젯이 준 토큰이다 — KDoc 이 `cf-turnstile-response` 라고 부른다.
 * 모듈은 HTTP 를 열지 않는다: 앱 컨트롤러가 요청 본문(또는 헤더)에서 토큰을 꺼내 `verify` 에 넘긴다.
 * 그래서 기본은 Cloudflare 위젯이 폼에 넣는 이름과 같은 본문 필드이고, 앱이 다른 곳에서 읽으면 이름을 바꾼다.
 */
export const TURNSTILE_RESPONSE_FIELD = 'cf-turnstile-response'
export const TURNSTILE_RESPONSE_HEADER = 'CF-Turnstile-Response'

/** 토큰이 없는데 붙이려 했다 — 보호 없는 요청이 조용히 나가지 않게 던진다(제출 버튼을 토큰이 올 때까지 막는다) */
export class TurnstileTokenMissingError extends Error {
  constructor() {
    super('The Turnstile token is missing — wait for the widget before submitting')
    this.name = 'TurnstileTokenMissingError'
  }
}

function required(token: string | null | undefined): string {
  if (!token) throw new TurnstileTokenMissingError()
  return token
}

/** JSON 본문이면 토큰이 든 새 객체를, `FormData` · `URLSearchParams` 면 거기에 붙여 그대로 돌려준다 */
export function attachTurnstileToken<T extends Record<string, unknown>>(
  body: T,
  token: string | null | undefined,
  options?: { field?: string },
): T & Record<string, string>
export function attachTurnstileToken<T extends FormData | URLSearchParams>(
  body: T,
  token: string | null | undefined,
  options?: { field?: string },
): T
export function attachTurnstileToken(
  body: Record<string, unknown> | FormData | URLSearchParams,
  token: string | null | undefined,
  { field = TURNSTILE_RESPONSE_FIELD }: { field?: string } = {},
) {
  const value = required(token)
  if (body instanceof FormData || body instanceof URLSearchParams) {
    body.append(field, value)
    return body
  }
  return { ...body, [field]: value }
}

/** 본문 대신 헤더로 보내는 앱용 — `client.value(path, { headers: turnstileHeaders(token) })` */
export function turnstileHeaders(
  token: string | null | undefined,
  { header = TURNSTILE_RESPONSE_HEADER }: { header?: string } = {},
): Record<string, string> {
  return { [header]: required(token) }
}
