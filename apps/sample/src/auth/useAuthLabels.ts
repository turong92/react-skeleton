import { koAuthLabels, type AuthLabels } from '@skeleton/auth'
import { useMemo } from 'react'
import { useT, type MessageKey } from '../i18n'

type Translate = (key: MessageKey) => string

/**
 * 계정 화면의 문구 — 이 앱이 쓰는 한 낱말(「닉네임」)에 맞춘다. 가입의 「닉네임」 칸은 서버가 그 값으로 **첫 닉네임**을 만든다는 도움말,
 * 계정 설정에는 닉네임 줄이 없으니(`authConfig.ts` 의 `showDisplayName: false`) 남은 절은 「언어 · 시간대」다 — 화면에 「프로필」이 나오지 않게.
 * 영어는 `@skeleton/auth` 의 기본값에 덮어쓸 것만 얹는다
 */
export function appAuthLabels(locale: string, t: Translate): Partial<AuthLabels> {
  const own: Partial<AuthLabels> = {
    displayNameHint: t('signup.nicknameHint'),
    sectionProfile: t('account.localeSection'),
    profileSaved: t('account.localeSaved'),
  }
  return locale === 'ko' ? { ...koAuthLabels, ...own } : own
}

/** 화면 언어에 맞는 인증 문구 */
export function useAuthLabels(): Partial<AuthLabels> {
  const { locale, t } = useT()
  // 같은 언어에서는 같은 객체 — 화면이 라벨의 동일성에 기대도 매번 새로 만들지 않는다
  return useMemo(() => appAuthLabels(locale, t), [locale, t])
}
