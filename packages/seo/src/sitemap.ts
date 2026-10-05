import { resolveUrl } from './url.ts'

export type SitemapEntry = {
  /** 사이트 안의 경로(`/pricing`) 또는 같은 호스트의 절대 주소 */
  path: string
  /** `YYYY-MM-DD` 또는 ISO 일시 */
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  /** 0 ~ 1 */
  priority?: number
  /** 같은 페이지의 다른 언어 */
  alternates?: Array<{ hreflang: string; path: string }>
}

const MAX_URLS = 50_000
const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}
const xml = (text: string) => text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char])
const LASTMOD = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/

function requireBase(baseUrl: string) {
  if (!/^https?:\/\/[^\s/]+/i.test(baseUrl))
    throw new Error(`baseUrl must be an absolute http(s) url (got "${baseUrl}")`)
  return new URL(baseUrl)
}

/** 사이트맵 XML. 같은 호스트의 절대 주소만, 중복 · `#해시` 제거, 날짜 · 우선순위 검사, 5만 개 한도 — 검색 엔진이 거절할 모양은 만들지 않고 던진다 */
export function sitemapXml(
  entries: Array<string | SitemapEntry>,
  { baseUrl }: { baseUrl: string },
): string {
  const base = requireBase(baseUrl)
  const seen = new Set<string>()
  const urls: string[] = []
  let alternates = false
  for (const raw of entries) {
    const entry = typeof raw === 'string' ? { path: raw } : raw
    const loc = resolveUrl(entry.path, baseUrl)
    if (!loc) throw new Error(`sitemap: cannot make an absolute http(s) url out of "${entry.path}"`)
    if (new URL(loc).origin !== base.origin)
      throw new Error(
        `sitemap: "${entry.path}" is not on the same host as baseUrl (${base.origin})`,
      )
    if (seen.has(loc)) continue
    seen.add(loc)
    if (entry.lastmod !== undefined && !LASTMOD.test(entry.lastmod))
      throw new Error(`sitemap: lastmod "${entry.lastmod}" must be YYYY-MM-DD or an ISO date-time`)
    if (entry.priority !== undefined && !(entry.priority >= 0 && entry.priority <= 1))
      throw new Error(`sitemap: priority ${entry.priority} must be between 0 and 1`)
    let body = `<loc>${xml(loc)}</loc>`
    if (entry.lastmod) body += `<lastmod>${xml(entry.lastmod)}</lastmod>`
    if (entry.changefreq) body += `<changefreq>${entry.changefreq}</changefreq>`
    if (entry.priority !== undefined) body += `<priority>${entry.priority}</priority>`
    for (const alternate of entry.alternates ?? []) {
      const href = resolveUrl(alternate.path, baseUrl)
      if (!href) throw new Error(`sitemap: bad alternate "${alternate.path}"`)
      alternates = true
      body += `<xhtml:link rel="alternate" hreflang="${xml(alternate.hreflang)}" href="${xml(href)}"/>`
    }
    urls.push(`<url>${body}</url>`)
    if (urls.length > MAX_URLS)
      throw new Error(
        `sitemap: more than ${MAX_URLS.toLocaleString('en-US')} urls — split it into several sitemaps`,
      )
  }
  const namespaces = `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${alternates ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${namespaces}>\n${urls.map((url) => `  ${url}`).join('\n')}\n</urlset>\n`
}

export type RobotsRule = { userAgent: string; allow?: string[]; disallow?: string[] }
export type RobotsOptions = {
  /** 있으면 `Sitemap:` 줄이 이 주소 아래 `/sitemap.xml` 을 가리킨다 */
  baseUrl?: string
  /** 기본 true. false 면 모두 막는다 — 미리보기 · 스테이징 빌드 */
  allowIndexing?: boolean
  /** `Sitemap:` 줄을 쓸지(기본 true — baseUrl 이 있을 때). 문자열이면 그 주소 */
  sitemap?: boolean | string
  /** 기본은 모두 허용 한 묶음. 주면 이것이 대신한다 */
  rules?: RobotsRule[]
}

const noBreak = (value: string, what: string) => {
  if (/[\r\n\u2028\u2029]/.test(value)) throw new Error(`robots.txt: ${what} contains a line break`)
  return value
}
const robotsPath = (value: string) => {
  noBreak(value, 'a path')
  if (!/^[/*]/.test(value)) throw new Error(`robots.txt: path "${value}" must start with / or *`)
  return value
}

/** robots.txt — 줄을 늘리는 값(개행)은 던진다 */
export function robotsTxt({
  baseUrl,
  allowIndexing = true,
  sitemap = true,
  rules,
}: RobotsOptions): string {
  const groups = (
    allowIndexing
      ? (rules ?? [{ userAgent: '*', allow: ['/'] }])
      : [{ userAgent: '*', disallow: ['/'] }]
  ).map((rule) =>
    [
      `User-agent: ${noBreak(rule.userAgent, 'a user agent')}`,
      ...(rule.allow ?? []).map((value) => `Allow: ${robotsPath(value)}`),
      ...(rule.disallow ?? []).map((value) => `Disallow: ${robotsPath(value)}`),
    ].join('\n'),
  )
  let text = `${groups.join('\n\n')}\n`
  if (allowIndexing && sitemap !== false) {
    let target: string | null = null
    if (typeof sitemap === 'string') target = sitemap
    else if (baseUrl) {
      const base = requireBase(baseUrl)
      target = `${base.origin}${base.pathname.replace(/\/+$/, '')}/sitemap.xml`
    }
    if (target) text += `\nSitemap: ${noBreak(target, 'the sitemap url')}\n`
  }
  return text
}
