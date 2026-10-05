import type { JsonLdNode, SeoDefaults, SeoMeta } from '@skeleton/seo'
import type { MessageKey } from '../i18n'

type Translate = (key: MessageKey) => string

/** 라우트의 `handle.seo` — 이 화면이 검색 · 공유 미리보기에 어떻게 보이는가. 문구는 사전 키(언어를 바꾸면 따라 바뀐다) */
export type SeoHandle = {
  seo: {
    titleKey: MessageKey
    descriptionKey: MessageKey
    /** 검색에 노출할까 — 로그인 뒤 화면 · 로그인 · 404 는 false(`noindex, nofollow`, canonical 없음) */
    indexable: boolean
    /** 구조화 데이터 — 같은 번역기로 만든다(방문자가 읽는 글과 크롤러가 받는 글이 같다) */
    jsonLd?: (t: Translate) => JsonLdNode[]
  }
}

export function seoMetaOf(
  { titleKey, descriptionKey, indexable, jsonLd }: SeoHandle['seo'],
  { t, pathname }: { t: Translate; pathname: string },
): SeoMeta {
  const base = { title: t(titleKey), description: t(descriptionKey) }
  return indexable
    ? { ...base, canonical: pathname, ...(jsonLd ? { jsonLd: jsonLd(t) } : {}) }
    : { ...base, robots: 'noindex, nofollow' }
}

export function seoDefaultsOf({
  siteName,
  locale,
  siteUrl,
}: {
  siteName: string
  locale: 'ko' | 'en'
  siteUrl: string | undefined
}): SeoDefaults {
  return {
    siteName,
    titleTemplate: `%s · ${siteName}`,
    baseUrl: siteUrl,
    locale: locale === 'ko' ? 'ko_KR' : 'en_US',
  }
}
