import { COUNTRY_ZONES } from './country-zones'

/**
 * 국가(ISO 3166-1 alpha-2) → IANA 시간대. "아티스트 국가를 고르면 시간대가 자동으로" 용.
 * 시간대가 하나면 확정, 여러 개(US, BR, AU …)면 첫 번째가 대표값이고 나머지가 선택지.
 * **결과는 저장할 것** — 국가만 저장하고 매번 계산하면 표를 고쳤을 때 기존 데이터가 움직인다.
 */
export function zonesOf(countryCode: string): readonly string[] {
  return COUNTRY_ZONES[countryCode.toUpperCase()] ?? []
}

export function defaultZoneOf(countryCode: string): string | undefined {
  return zonesOf(countryCode)[0]
}

export function isSingleZone(countryCode: string): boolean {
  return zonesOf(countryCode).length === 1
}
