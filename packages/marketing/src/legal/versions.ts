export type LegalVersion = {
  /** 표시용 버전(`2.0` · `2026-10`) — 서로 달라야 한다 */
  version: string
  /** 효력이 생기는 날 `YYYY-MM-DD`(달력 날짜 — 시간대로 옮기지 않는다) */
  effectiveDate: string
  markdown: string
}

/** 효력일이 늦은 것부터. 입력은 바꾸지 않는다 */
export const sortVersions = (versions: LegalVersion[]): LegalVersion[] =>
  [...versions].sort((a, b) =>
    a.effectiveDate < b.effectiveDate ? 1 : a.effectiveDate > b.effectiveDate ? -1 : 0,
  )

/** 그날 이미 효력이 있는 것 중 가장 늦은 판 — 모두 아직이면 가장 이른 판(보여 줄 것이 있게) */
export function currentVersionOf(
  versions: LegalVersion[],
  today: string,
): LegalVersion | undefined {
  const sorted = sortVersions(versions)
  return sorted.find((version) => version.effectiveDate <= today) ?? sorted.at(-1)
}
