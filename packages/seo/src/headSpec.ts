import { serializeJsonLd, type JsonLdNode } from './jsonLd'
import { resolveUrl } from './url'

export type SeoDefaults = {
  /** 사이트 이름 — 제목이 없을 때의 제목, `og:site_name` */
  siteName: string
  /** `%s` 가 페이지 제목 자리(기본 `%s`) — 예 `%s · Notes` */
  titleTemplate?: string
  /** 사이트의 절대 주소(`https://notes.example.com`, 경로 접두 가능). 없으면 상대 주소(canonical · 이미지)를 절대로 만들 수 없어 그 태그는 빠진다 */
  baseUrl?: string
  description?: string
  image?: string
  /** `og:locale` 형식 — `ko_KR` · `en_US` */
  locale?: string
  /** `@계정` */
  twitterSite?: string
}

export type SeoMeta = {
  title?: string
  description?: string
  /** 대표 주소(경로 또는 절대). `#해시` 는 버린다 */
  canonical?: string
  /** 예 `noindex, nofollow` — 계정 · 404 · 결제 같은 검색에 안 뜰 페이지 */
  robots?: string
  image?: string
  imageAlt?: string
  type?: 'website' | 'article'
  locale?: string
  alternates?: Array<{ hreflang: string; href: string }>
  jsonLd?: JsonLdNode | JsonLdNode[]
}

export type HeadTag = {
  tag: 'meta' | 'link' | 'script'
  attrs: Record<string, string>
  text?: string
}
export type HeadSpec = { title: string; tags: HeadTag[] }

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/** 한 페이지의 머리 — 제목 + `<meta>` · `<link>` · JSON-LD `<script>` 목록. 서버(`renderHeadHtml`)와 브라우저(`applyHead`)가 같은 것을 쓴다 */
export function buildHeadSpec(meta: SeoMeta, defaults: SeoDefaults): HeadSpec {
  const pageTitle = squash(meta.title ?? '')
  const showTitle = pageTitle && pageTitle !== defaults.siteName ? pageTitle : ''
  const title = showTitle
    ? (defaults.titleTemplate ?? '%s').replace('%s', () => showTitle)
    : defaults.siteName
  const shared = showTitle || defaults.siteName
  const description = squash(meta.description ?? defaults.description ?? '')
  const canonical = meta.canonical ? resolveUrl(meta.canonical, defaults.baseUrl) : null
  const imageInput = meta.image ?? defaults.image
  const image = imageInput ? resolveUrl(imageInput, defaults.baseUrl) : null
  const locale = meta.locale ?? defaults.locale

  const tags: HeadTag[] = []
  const metaName = (name: string, content: string | null | undefined) => {
    if (content) tags.push({ tag: 'meta', attrs: { name, content } })
  }
  const metaProperty = (property: string, content: string | null | undefined) => {
    if (content) tags.push({ tag: 'meta', attrs: { property, content } })
  }

  metaName('description', description)
  metaName('robots', meta.robots?.trim())
  if (canonical) tags.push({ tag: 'link', attrs: { rel: 'canonical', href: canonical } })
  for (const alternate of meta.alternates ?? []) {
    const href = resolveUrl(alternate.href, defaults.baseUrl)
    if (href)
      tags.push({ tag: 'link', attrs: { rel: 'alternate', hreflang: alternate.hreflang, href } })
  }

  metaProperty('og:title', shared)
  metaProperty('og:description', description)
  metaProperty('og:type', meta.type ?? 'website')
  metaProperty('og:url', canonical)
  metaProperty('og:site_name', defaults.siteName)
  metaProperty('og:locale', locale)
  metaProperty('og:image', image)
  if (image) metaProperty('og:image:alt', meta.imageAlt)

  metaName('twitter:card', image ? 'summary_large_image' : 'summary')
  metaName('twitter:title', shared)
  metaName('twitter:description', description)
  metaName('twitter:image', image)
  metaName('twitter:site', defaults.twitterSite)

  const nodes =
    meta.jsonLd === undefined ? [] : Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]
  for (const node of nodes)
    tags.push({
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      text: serializeJsonLd({ '@context': 'https://schema.org', ...node }),
    })

  return { title, tags }
}
