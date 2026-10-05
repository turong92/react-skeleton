import { useSeo } from '@skeleton/seo'
import { useLocation, useMatches } from 'react-router-dom'
import { languageOf, useT } from '../i18n'
import { seoDefaultsOf, seoMetaOf, type SeoHandle } from './routeSeo'
import { SITE_URL } from './siteUrl'

/** 맞은 라우트들 중 가장 안쪽 `handle.seo` 로 문서의 머리(제목 · 설명 · canonical · OG · robots · JSON-LD)를 맞춘다. 아무것도 그리지 않는다 */
export function PageSeo() {
  const { t, locale } = useT()
  const { pathname } = useLocation()
  const matches = useMatches()
  const seo = [...matches]
    .reverse()
    .map((match) => (match.handle as Partial<SeoHandle> | undefined)?.seo)
    .find(Boolean)
  useSeo(
    seo ? seoMetaOf(seo, { t: (key) => t(key), pathname }) : {},
    seoDefaultsOf({ siteName: t('appName'), locale: languageOf(locale), siteUrl: SITE_URL }),
  )
  return null
}
