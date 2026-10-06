import type { ReactNode } from 'react'

/** 소셜 로그인 버튼 하나 */
export type SocialProviderButton = {
  /** 백엔드 제공자 코드(`google` · `kakao` · `naver` …) */
  provider: string
  /** 버튼 글자 — 없으면 `labels.providerNames[provider]` 로 `signInWithProvider` 를 채운다 */
  label?: string
  icon?: ReactNode
}

/**
 * 이 앱이 켜 둔 로그인 방법. 화면은 이것만 보고 그린다 — 방법을 더하고 빼는 일은 앱의 설정 한 곳이다.
 * (백엔드가 어떤 방법을 열었는지 알려 주는 엔드포인트는 없다 — 앱의 설정이 백엔드의 모듈 · 설정과 같아야 한다.)
 */
export type SignInMethodsConfig = {
  /** 이메일 + 비밀번호(기본 true) */
  password?: boolean
  /** 이메일 링크(auth-magic-link 모듈이 있을 때) */
  magicLink?: boolean
  /** 소셜 제공자 버튼(auth-social-* 모듈 + 제공자 설정이 있을 때) */
  social?: SocialProviderButton[]
}

export type ResolvedMethods = {
  password: boolean
  magicLink: boolean
  social: SocialProviderButton[]
}

export function resolveMethods(methods?: SignInMethodsConfig): ResolvedMethods {
  return {
    password: methods?.password ?? true,
    magicLink: methods?.magicLink ?? false,
    social: methods?.social ?? [],
  }
}
