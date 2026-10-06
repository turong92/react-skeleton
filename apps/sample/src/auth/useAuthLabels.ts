import { koAuthLabels, type AuthLabels } from '@skeleton/auth'
import { useT } from '../i18n'

/** 화면 언어에 맞는 인증 문구 — 영어는 `@skeleton/auth` 의 기본값이라 undefined */
export function useAuthLabels(): Partial<AuthLabels> | undefined {
  const { locale } = useT()
  return locale === 'ko' ? koAuthLabels : undefined
}
