import { useContext, useEffect } from 'react'
import { applyHead } from './applyHead'
import { buildHeadSpec, type SeoDefaults, type SeoMeta } from './headSpec'
import { SeoContext } from './seoContext'

/**
 * 이 화면의 머리(제목 · 설명 · canonical · OG · JSON-LD)를 브라우저 문서에 맞춘다 — 화면이 바뀔 때마다. 아무것도 그리지 않는다.
 * 서버 렌더 앱은 서버가 `buildHeadSpec` + `renderHeadHtml` 로 첫 응답의 머리를 쓰고, 이것은 그 뒤 화면 전환만 맡는다.
 */
export function useSeo(meta: SeoMeta, defaults?: SeoDefaults) {
  const inherited = useContext(SeoContext)
  const merged = defaults ?? inherited
  // `meta` 는 렌더마다 새 객체라 내용(JSON)이 같으면 다시 하지 않는다
  const key = JSON.stringify([meta, merged])
  useEffect(() => {
    if (merged) applyHead(buildHeadSpec(JSON.parse(key)[0] as SeoMeta, merged), document)
  }, [key, merged])
}
