import { koLegalLabels, type LegalLabels } from '@skeleton/legal'
import { languageOf, useT } from '../i18n'

/** 화면 언어에 맞는 약관 문구 · 읽을 언어 · 날짜 서식 로케일 — 영어는 `@skeleton/legal` 의 기본값이라 labels 가 undefined */
export function useLegalLocale(): {
  locale: 'ko' | 'en'
  formatLocale: string
  labels: Partial<LegalLabels> | undefined
} {
  const { locale } = useT()
  const lang = languageOf(locale)
  return {
    locale: lang,
    formatLocale: lang === 'ko' ? 'ko-KR' : 'en-US',
    labels: lang === 'ko' ? koLegalLabels : undefined,
  }
}
