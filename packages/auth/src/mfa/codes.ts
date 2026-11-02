/** 백엔드 `auth-mfa` 모듈의 오류 코드 · 두 번째 단계 응답 코드 */
export const MFA_CODES = {
  /** 1단계가 맞았고 2단계가 켜진 계정이다(403, `data` = `{mfaToken, methods, expiresAt}`) - 세션은 열리지 않았다 */
  REQUIRED: 'AUTH.MFA_REQUIRED',
  /** 코드가 틀렸다(400, `data.attemptsLeft` 가 있을 수 있다) */
  CODE_INVALID: 'MFA.CODE_INVALID',
  /** 대기가 만료되었거나 시도 5번을 다 썼다(410) - 1단계부터 다시 */
  CHALLENGE_EXPIRED: 'MFA.CHALLENGE_EXPIRED',
  /** 계정의 틀린 시도 한도(429, `Retry-After`) */
  TOO_MANY_ATTEMPTS: 'MFA.TOO_MANY_ATTEMPTS',
  /** 등록을 시작한 적 없거나 10분이 지났다(410) - 처음부터 */
  ENROLLMENT_EXPIRED: 'MFA.ENROLLMENT_EXPIRED',
  /** 필수 대상인데 아직 등록 전이다(403) - 허용 목록 밖의 모든 호출이 이 코드로 막힌다. 등록하면 바로 풀린다 */
  ENROLLMENT_REQUIRED: 'MFA.ENROLLMENT_REQUIRED',
  /** 운영 해제: 자기 자신은 못 한다(409) */
  SELF_RESET: 'MFA.SELF_RESET',
  /** 운영 해제: 대상이 호출자보다 권한이 많다(403) */
  ESCALATION: 'MFA.ESCALATION',
  /** 꺼져 있는데 끄기 · 재발급(409) */
  NOT_ENABLED: 'MFA.NOT_ENABLED',
  /** 필수 대상이라 끌 수 없다(409) - 재등록은 된다 */
  REQUIRED_BY_POLICY: 'MFA.REQUIRED_BY_POLICY',
} as const

/** 대기 하나에 허용되는 시도(백엔드 계약) - 서버가 `attemptsLeft` 를 주지 않을 때 화면이 센다 */
export const MFA_CHALLENGE_ATTEMPTS = 5
