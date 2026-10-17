/**
 * 키가 어느 목록의 몇 번째인가 - 서명 열람은 키가 아니라 (목록, 순번)으로 부른다.
 * 공개본의 첨부에서 먼저 찾고, 없으면 대기 중인 고친 판의 첨부에서 찾는다(`from: 'edit'`).
 */
export function locate(
  current: readonly string[] | undefined,
  edit: readonly string[] | undefined,
  key: string,
): { index: number; from: 'current' | 'edit' } | undefined {
  const inCurrent = current?.indexOf(key) ?? -1
  if (inCurrent >= 0) return { index: inCurrent, from: 'current' }
  const inEdit = edit?.indexOf(key) ?? -1
  return inEdit >= 0 ? { index: inEdit, from: 'edit' } : undefined
}
