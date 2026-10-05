import { createI18n, useT as useTranslation } from '@skeleton/i18n'
import ko from './ko'

/*
 * 이 앱의 i18n 인스턴스 하나(`@skeleton/i18n`). 기본 언어 ko 는 번들에 들어 있고, en 은 고를 때 불러온다(지연 로딩).
 * 사용자가 직접 고른 언어만 `notes:ui-locale` 에 저장한다 — 저장하지 않은 첫 방문은 브라우저 언어를 따른다(`main.tsx` 가 `i18n.init()`).
 */
export const i18n = createI18n({
  catalogs: { ko, en: () => import('./en') },
  defaultLocale: 'ko',
  storageKey: 'notes:ui-locale',
})

/** 문구 키 — 기본 언어 사전의 키라 `t('login.titel')` 같은 오타가 컴파일 오류다 */
export type MessageKey = Parameters<typeof i18n.t>[0]

/** 컴포넌트에서: `const { t } = useT()`. 언어를 바꾸면 이 훅을 쓰는 컴포넌트가 그 자리에서 다시 그린다 */
export const useT = () => useTranslation<MessageKey>(i18n)

/** 사전이 있는 언어(ko · en)로 좁힌다 — `useT().locale` 은 그냥 문자열이라, 언어별 데이터(가격 · 문서)를 고를 때 */
export const languageOf = (locale: string): 'ko' | 'en' => (locale === 'ko' ? 'ko' : 'en')
