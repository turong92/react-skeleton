/*
 * 응답 본문을 키 이름이 아니라 **값**으로 훑는다 — 서버가 연결 고리를 어떤 이름의 칸에 실어도(`authorId` · `ref` · `link` …) 두 글에 같은 값이 있으면 잡힌다.
 * 비교에서 빼는 것: null · 불리언 · 숫자(개수 · 번호) · 빈 문자열 · 허용한 어휘(게시판 코드 · 상태 · 반응 종류).
 */

/** 객체 · 배열을 재귀로 펴서 문자열 잎 값만 모은다 */
export function leafValues(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(leafValues)
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(leafValues)
  return []
}

/** 두 응답 묶음의 잎 값 교집합 — 허용한 어휘와 빈 문자열은 뺀다 */
export function sharedLeafValues(
  first: readonly unknown[],
  second: readonly unknown[],
  allowed: ReadonlySet<string>,
): string[] {
  const keep = (value: string) => value !== '' && !allowed.has(value)
  const left = new Set(first.flatMap(leafValues).filter(keep))
  return [...new Set(second.flatMap(leafValues).filter((v) => left.has(v)))]
}
