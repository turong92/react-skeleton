/** 나라 이름을 화면 언어로 - 모르면 코드 그대로. 나라는 서버가 정한다(`GET /config` 의 `country`); 화면은 이름만 보여 준다 */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
