import { robotsTxt, sitemapXml, type RobotsOptions, type SitemapEntry } from './sitemap.ts'

export type SeoFilesOptions = {
  /** 사이트의 절대 주소(`https://notes.example.com`) — 보통 빌드 환경변수. 없으면 사이트맵을 못 만든다(주소는 절대여야 한다) */
  baseUrl?: string
  /** 사이트맵에 넣을 **공개** 페이지(로그인 뒤 화면은 넣지 않는다) */
  routes: Array<string | SitemapEntry>
  /** `allowIndexing: false` 면 스테이징 · 미리보기 빌드 — 전부 막는다 */
  robots?: Omit<RobotsOptions, 'baseUrl'>
}

type Context = {
  /** Vite 6+ — 서버(SSR) 번들 빌드를 알아본다. 없으면 브라우저 번들로 본다 */
  environment?: { config?: { consumer?: string } }
  emitFile(file: { type: 'asset'; fileName: string; source: string }): unknown
  warn(message: string): void
}

/**
 * 정적 빌드가 `sitemap.xml` · `robots.txt` 를 함께 내게 한다 — `vite.config.ts` 의 `plugins` 에
 * `seoFiles({ baseUrl: process.env.SITE_URL, routes: ['/', '/terms'] })`. Vite 플러그인 꼴(vite 를 import 하지 않는다).
 * `baseUrl` 이 없으면 robots.txt 만 내고 이유를 경고한다.
 */
export function seoFiles({ baseUrl, routes, robots }: SeoFilesOptions) {
  return {
    name: 'skeleton-seo-files',
    generateBundle(this: Context) {
      // 같은 앱의 서버(SSR) 번들 빌드에는 쓰지 않는다 — 두 파일은 브라우저 번들(정적 파일) 옆에 있어야 한다
      if (this.environment?.config?.consumer === 'server') return
      if (baseUrl) {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: sitemapXml(routes, { baseUrl }),
        })
      } else {
        this.warn(
          'seoFiles: no baseUrl, so sitemap.xml was not written (set it, e.g. SITE_URL=https://example.com)',
        )
      }
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsTxt({ baseUrl, ...robots }),
      })
    },
  }
}
