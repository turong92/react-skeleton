import type { ReactNode } from 'react'
import type { SeoDefaults, SeoMeta } from './headSpec'
import { SeoContext } from './seoContext'
import { useSeo } from './useSeo'

/** 앱 루트에 한 번 — 사이트 이름 · 제목 템플릿 · 기본 설명 · baseUrl 을 모든 `<Seo>` 에 준다 */
export function SeoProvider({
  defaults,
  children,
}: {
  defaults: SeoDefaults
  children: ReactNode
}) {
  return <SeoContext.Provider value={defaults}>{children}</SeoContext.Provider>
}

/** `useSeo` 의 컴포넌트 꼴 — 화면 안에 `<Seo title="…" />` 한 줄. 아무것도 그리지 않는다 */
export function Seo(props: SeoMeta & { defaults?: SeoDefaults }) {
  const { defaults, ...meta } = props
  useSeo(meta, defaults)
  return null
}
