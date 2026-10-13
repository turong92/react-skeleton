/**
 * 개발용 나라 고르기(로컬 전용) - 서버가 `routing.dev-country-switch` 를 켠 때만 `X-Dev-Country` 헤더를 읽는다(꺼져 있으면 서버는 완전히 무시).
 * 고른 값은 브라우저가 기억하고 API 클라이언트가 모든 요청에 붙인다 - 화면(`/config`)과 주문 · 구독이 같은 나라를 본다.
 */
export const DEV_COUNTRIES = ['KR', 'US', 'JP'] as const
const KEY = 'notes:dev-country'

export function getDevCountry(): string | null {
  try {
    const value = window.localStorage.getItem(KEY)
    return value && /^[A-Z]{2}$/.test(value) ? value : null
  } catch {
    return null
  }
}

export function setDevCountry(country: string | null): void {
  try {
    if (country) window.localStorage.setItem(KEY, country)
    else window.localStorage.removeItem(KEY)
  } catch {
    // 저장소를 못 쓰는 환경 - 이번 방문에서만 고른 값이 사라진다
  }
}

/** 고른 나라가 있으면 요청 헤더로 */
export function devCountryHeaders(): Record<string, string> | undefined {
  const country = getDevCountry()
  return country ? { 'X-Dev-Country': country } : undefined
}
