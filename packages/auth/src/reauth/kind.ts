import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import type { AccountMe } from '../account/types'

/**
 * 민감한 작업(이메일 변경 · 첫 비밀번호 · 소셜 연결 · 연결 해제 · 삭제)의 다시 인증 세 가지 —
 * `password` 현재 비밀번호 · `code` 계정 주소로 받은 6자리를 그 자리에서 입력 · `provider` 이미 연결된 제공자의 동의를 다시 거친다(주소가 없는 계정).
 * 서버가 같은 규칙으로 강제한다(계정에 맞는 증거 하나) — 화면은 `me` 로 같은 것을 골라 처음부터 맞는 입력을 보인다.
 */
export type ReauthKind = 'password' | 'code' | 'provider'

/** 종류를 고르는 데 필요한 `me` 의 부분 */
export type ReauthSubject = {
  hasPassword: boolean
  email: string | null
  /** 연결된 소셜 제공자(`password` · `magic_link` 는 제공자가 아니다) */
  providers: string[]
}

const NOT_PROVIDERS = new Set(['password', 'magic_link'])

export function reauthSubjectOf(
  me: Pick<AccountMe, 'hasPassword' | 'email' | 'methods'>,
): ReauthSubject {
  return {
    hasPassword: me.hasPassword,
    email: me.email?.trim() ? me.email : null,
    providers: me.methods.filter((m) => !NOT_PROVIDERS.has(m.method)).map((m) => m.method),
  }
}

export function reauthKindOf(subject: ReauthSubject): ReauthKind {
  if (subject.hasPassword) return 'password'
  if (subject.email) return 'code'
  return 'provider'
}

/** 증거 입력 자리가 스스로 설명하는 오류(틀린 비밀번호 · 틀린/만료 코드 · 실패한 제공자 증명 · 증거 없음) — 같은 말을 위쪽 오류 줄에 또 하지 않게 가른다 */
export const isReauthFailure = (error: unknown): boolean =>
  isErrorCode(error, [
    ErrorCodes.ACCOUNT_CURRENT_PASSWORD_INVALID,
    ErrorCodes.ACCOUNT_CODE_INVALID,
    ErrorCodes.ACCOUNT_CODE_EXPIRED,
    ErrorCodes.ACCOUNT_REAUTH_FAILED,
    ErrorCodes.ACCOUNT_REAUTH_REQUIRED,
  ])
