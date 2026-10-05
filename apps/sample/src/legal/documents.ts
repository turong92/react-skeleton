import type { LegalVersion } from '@skeleton/marketing'

export type LegalDoc = 'terms' | 'privacy'
export type LegalLocale = 'ko' | 'en'

/*
 * 법적 문서는 파일이다 — `documents/<문서>/<언어>/<버전>@<효력일>.md`. 새 판은 파일을 하나 더하면 된다(예: `3.0@2027-03-01.md`).
 * 파일에는 문서 제목을 쓰지 않는다(페이지의 h1) — `# ` 가 절이다. 이 폴더의 문서는 **템플릿**이고 모든 판 첫 줄에 TEMPLATE 표시가 있다.
 */
const files = import.meta.glob('./documents/*/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** 그 문서 · 언어의 모든 판(효력일 순 정렬은 `LegalDocumentPage` 가 한다). 그 언어 파일이 없으면 한국어(기본 언어)로 */
export function legalVersions(doc: LegalDoc, locale: LegalLocale): LegalVersion[] {
  const pick = (lang: LegalLocale) =>
    Object.entries(files).flatMap(([path, markdown]) => {
      const match = new RegExp(
        `^\\./documents/${doc}/${lang}/(.+)@(\\d{4}-\\d{2}-\\d{2})\\.md$`,
      ).exec(path)
      return match ? [{ version: match[1], effectiveDate: match[2], markdown }] : []
    })
  const found = pick(locale)
  return found.length > 0 ? found : pick('ko')
}
