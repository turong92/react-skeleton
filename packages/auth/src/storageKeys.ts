export type AuthStorageKeys = {
  accessToken: string
  refresh: string
  /** `navigator.locks` 이름 — 갱신 한 줄 세우기 */
  refreshLock: string
  returnTo: string
  /** 소셜 로그인 state 접두어 */
  social: string
  /** 소셜 연결 state 접두어 */
  socialLink: string
  /** 진행 중인 가입 시도(코드 입력 단계) */
  signUp: string
}

/**
 * 저장 키 · 락 이름 한 벌 — 같은 출처에 앱 둘을 경로로 나눠 올려도 토큰 · 락이 섞이지 않게 앱 이름을 접두어로 단다.
 * 기본 이름공간 `skeleton` 은 이 패키지가 늘 쓰던 이름 그대로다. 앱은 자기 이름으로 한 번 만들어 모든 곳에 넘긴다(`new-project.sh` 가 이름을 찍는다).
 */
export function authStorageKeys(namespace = 'skeleton'): AuthStorageKeys {
  if (!/^[A-Za-z0-9_-]+$/.test(namespace))
    throw new Error(`auth namespace must be letters, digits, "-" or "_": "${namespace}"`)
  return {
    accessToken: `${namespace}.accessToken`,
    refresh: `${namespace}.refresh`,
    refreshLock: `${namespace}.auth.refresh`,
    returnTo: `${namespace}.returnTo`,
    social: `${namespace}.social.`,
    socialLink: `${namespace}.social-link.`,
    signUp: `${namespace}.signUp`,
  }
}
