/*
 * PKCE(RFC 7636) · state · nonce 를 만드는 곳. 브라우저의 WebCrypto 만 쓴다 — 없으면 `Math.random` 으로 대신하지 않고 멈춘다
 * (예측 가능한 verifier 는 PKCE 를 무의미하게 만든다). 호출은 모두 실행 시점이며 import 때는 아무 전역도 읽지 않는다(SSR 안전).
 */

/** WebCrypto 가 없다 — 안전한 난수 · SHA-256 을 쓸 수 없는 환경(보안 컨텍스트가 아닌 http 주소의 옛 브라우저 등) */
export class PkceUnavailableError extends Error {
  constructor() {
    super('WebCrypto (crypto.getRandomValues / crypto.subtle) is not available in this context')
    this.name = 'PkceUnavailableError'
  }
}

export function hasWebCrypto(): boolean {
  const c = (globalThis as { crypto?: Crypto }).crypto
  return !!c && typeof c.getRandomValues === 'function' && !!c.subtle
}

function randomBytes(length: number): Uint8Array {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c || typeof c.getRandomValues !== 'function') throw new PkceUnavailableError()
  return c.getRandomValues(new Uint8Array(length))
}

/** 패딩 없는 base64url */
export function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 32 바이트 난수 → 43 글자(`[A-Za-z0-9-_]`) — 시도마다 새로 만든다 */
export function createCodeVerifier(): string {
  return base64url(randomBytes(32))
}

/** `BASE64URL(SHA-256(ASCII(verifier)))` — 방식은 늘 S256 이다(백엔드는 `plain` 을 받지 않는다) */
export async function codeChallengeS256(verifier: string): Promise<string> {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c?.subtle) throw new PkceUnavailableError()
  const digest = await c.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/** 16 바이트 난수의 base64url(22 글자, 인쇄 가능한 ASCII) */
export const createNonce = (): string => base64url(randomBytes(16))

/** CSRF 방지 `state` — 16 바이트 이상 */
export const createState = (): string => base64url(randomBytes(24))
