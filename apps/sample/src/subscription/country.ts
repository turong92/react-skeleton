/**
 * 구독을 시작할 때 받는 구매자 나라 - 서버는 이 나라로 해지·환불 정책을 고른다(견본: 한국이면 중도 해지 · 7일 철회, 그 밖은 기간 끝 해지만).
 * 화면 언어로 미리 채우고 사람이 바꿀 수 있다.
 */
export const COUNTRIES = ['KR', 'US', 'JP', 'GB', 'DE', 'FR', 'CA', 'AU', 'SG'] as const

const FALLBACK = 'KR'

/** 화면 언어(`ko` · `en-GB` …)가 가장 흔히 쓰이는 나라(ISO-3166 두 글자) - 모르면 한국 */
export function countryForLocale(locale: string): string {
  try {
    const region = new Intl.Locale(locale).maximize().region
    return region && /^[A-Z]{2}$/.test(region) ? region : FALLBACK
  } catch {
    return FALLBACK
  }
}

/** 고르는 목록 - 미리 채운 나라가 목록에 없어도 들어간다 */
export function countryOptions(prefilled: string): string[] {
  return [...new Set([prefilled, ...COUNTRIES])]
}

/** 나라 이름을 화면 언어로 - 모르면 코드 그대로 */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
