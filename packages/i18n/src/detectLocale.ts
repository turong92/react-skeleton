export type DetectLocaleInput<L extends string> = {
  supported: readonly L[]
  defaultLocale: L
  /** 사용자가 직접 고르고 저장해 둔 값(없으면 null) */
  stored: string | null
  /** 브라우저 언어 목록(우선순위 순). 서버에는 없다 — 빈 목록 */
  languages: readonly string[]
}

/**
 * 저장한 선택 → 브라우저 언어(전체 태그 `pt-BR` 가 먼저, 다음 주 태그 `pt`) → 기본 언어.
 * 순수 함수 — 저장소 · navigator 는 부르는 쪽이 읽어 넘긴다(서버에서도 그대로 돈다).
 */
export function detectLocale<L extends string>(input: DetectLocaleInput<L>): L {
  const { supported, defaultLocale, stored, languages } = input
  const find = (tag: string): L | undefined =>
    supported.find((locale) => locale.toLowerCase() === tag.toLowerCase())
  const remembered = stored === null ? undefined : find(stored)
  if (remembered) return remembered
  for (const raw of languages) {
    const tag = raw.replace('_', '-')
    const match = find(tag) ?? find(tag.split('-')[0])
    if (match) return match
  }
  return defaultLocale
}
