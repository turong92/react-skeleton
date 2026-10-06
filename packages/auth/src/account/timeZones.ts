const FALLBACK = ['UTC', 'Asia/Seoul', 'Asia/Tokyo', 'America/New_York', 'Europe/London']

/** 고를 수 있는 IANA 시간대 — 브라우저(`Intl.supportedValuesOf`)가 알면 그 목록, 아니면 짧은 기본 목록. `UTC` · `Asia/Seoul` 은 항상 있다 */
export function supportedTimeZones(): string[] {
  let found: string[] = []
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    found = intl.supportedValuesOf?.('timeZone') ?? []
  } catch {
    found = []
  }
  return [...new Set([...FALLBACK, ...found])].sort()
}

/** 저장된 값이 목록에 없어도(예: 구형 별칭) 고른 채로 보이게 맨 앞에 한 번 둔다 */
export function withCurrent(zones: string[], current: string | null | undefined): string[] {
  return current && !zones.includes(current) ? [current, ...zones] : zones
}
