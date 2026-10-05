/*
 * 주소 만들기 — 이 파일을 쓰는 `sitemap.ts` · `vite.ts` 는 vite.config.ts 가 Node 로 직접 읽는다.
 * 그래서 그쪽 import 에는 `.ts` 를 적는다(packages/theme/src/vite.ts 와 같은 사정).
 */
const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i

/**
 * 주소를 절대 http(s) 주소로. 이미 절대면 그대로(http · https 만), 상대면 `baseUrl` 에 붙인다 — `baseUrl` 의 경로 접두(`/app/`)는 유지한다.
 * `#해시` 는 버린다. 만들 수 없으면(상대인데 baseUrl 이 없음 · 다른 스킴 · 깨진 주소) null.
 */
export function resolveUrl(input: string, baseUrl?: string): string | null {
  try {
    let url: URL
    if (ABSOLUTE.test(input)) url = new URL(input)
    else {
      if (!baseUrl) return null
      const base = new URL(baseUrl)
      const prefix = base.pathname.replace(/\/+$/, '')
      const rest = input.startsWith('/') || input.startsWith('?') ? input : `/${input}`
      url = new URL(`${base.origin}${prefix}${rest === '/' && prefix ? '/' : rest}`)
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}
