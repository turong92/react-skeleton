const SHAPE = /^\d{1,9}(\.\d{1,9}){0,3}$/

/**
 * 버전 글자 → 숫자 칸(1~4칸). 스토어 빌드 번호(`+45`)와 접미사(`-beta.1`)는 떼고 읽는다.
 * 읽을 수 없으면 null — 버전을 몰라서 사용자를 막는 일은 없다.
 */
export function parseVersion(raw: string): number[] | null {
  const core = raw.trim().split(/[+-]/, 1)[0] ?? ''
  return SHAPE.test(core) ? core.split('.').map(Number) : null
}

/** `version` 이 `limit` 보다 낮은가 — 칸마다 숫자로 비교한다(`1.9` < `1.10`, `1.2` = `1.2.0`). 어느 쪽이든 읽을 수 없으면 false */
export function isBelow(version: string, limit: string): boolean {
  const a = parseVersion(version)
  const b = parseVersion(limit)
  if (a === null || b === null) return false
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff < 0
  }
  return false
}
