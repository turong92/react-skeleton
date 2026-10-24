/** 전권 - 백엔드 super-role 이 가진 `*` */
export const ALL_PERMISSIONS = '*'

/** `*` 는 모든 키를 통과시키고, 빈 목록은 모두 거절한다. 키를 여럿 주면 하나만 있어도 통과(anyOf) */
export function hasPermission(
  permissions: readonly string[] | null | undefined,
  key: string | readonly string[],
): boolean {
  if (!permissions || permissions.length === 0) return false
  if (permissions.includes(ALL_PERMISSIONS)) return true
  const keys = typeof key === 'string' ? [key] : key
  return keys.some((k) => permissions.includes(k))
}
