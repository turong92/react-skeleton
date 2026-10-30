import { ApiRequestError, isErrorCode } from '@skeleton/api-client'
import { MFA_CODES } from './codes'

/** 대기가 끝났다 - 만료 · 시도 소진(410) */
export function isMfaChallengeExpired(error: unknown): boolean {
  return (
    isErrorCode(error, MFA_CODES.CHALLENGE_EXPIRED) ||
    (error instanceof ApiRequestError && error.apiError.status === 410)
  )
}

/**
 * 코드가 틀렸다 - 계약의 `MFA.CODE_INVALID` 말고도 400 · 401 은 같은 뜻으로 읽는다(서버 코드 이름이 달라도 화면이 막히지 않게).
 * 다시 인증 실패(틀린 비밀번호 · 메일 코드)와 한 요청에 섞이는 곳(끄기)에서는 **다시 인증 실패를 먼저** 가른다
 */
export function isMfaCodeWrong(error: unknown): boolean {
  return (
    isErrorCode(error, MFA_CODES.CODE_INVALID) ||
    (error instanceof ApiRequestError &&
      (error.apiError.status === 400 || error.apiError.status === 401))
  )
}

/** 서버가 알려 준 남은 시도(`data.attemptsLeft`) */
export function mfaAttemptsLeft(error: unknown): number | undefined {
  if (!(error instanceof ApiRequestError)) return undefined
  const left = (error.apiError.data as { attemptsLeft?: unknown } | undefined)?.attemptsLeft
  return typeof left === 'number' ? left : undefined
}

/** 이 기능이 꺼진 서버(경로 404) - `skeleton.auth-mfa` 가 없다 */
export const isMfaOff = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.status === 404
