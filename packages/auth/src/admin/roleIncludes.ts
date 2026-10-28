import type { AdminRole } from './rolesApi'

const byName = (roles: readonly AdminRole[]) => new Map(roles.map((r) => [r.name, r]))

/**
 * `name` 이 `candidate` 를 포함하면 고리가 생기는가 - 자기 자신이거나, `candidate` 에서 포함 사슬을 따라가면 `name` 에 닿을 때.
 * 서버의 `AUTHZ.ROLE_CYCLE` 을 보내기 전에 후보를 막는 용도(서버가 최종 판정).
 */
export function wouldCycle(roles: readonly AdminRole[], name: string, candidate: string): boolean {
  if (candidate === name) return true
  const map = byName(roles)
  const seen = new Set<string>()
  const stack = [candidate]
  while (stack.length > 0) {
    const current = stack.pop() as string
    if (current === name) return true
    if (seen.has(current)) continue
    seen.add(current)
    stack.push(...(map.get(current)?.includes ?? []))
  }
  return false
}

/**
 * `name` 이 포함 사슬로 물려받는 권한 → 그 권한을 처음 들고 있는 역할(가까운 쪽부터 넓이 우선).
 * 고리나 모르는 역할은 건너뛴다. 자기 권한은 넣지 않는다.
 */
export function inheritedFrom(roles: readonly AdminRole[], name: string): Map<string, string> {
  const map = byName(roles)
  const out = new Map<string, string>()
  const seen = new Set<string>([name])
  const queue = [...(map.get(name)?.includes ?? [])]
  while (queue.length > 0) {
    const current = queue.shift() as string
    if (seen.has(current)) continue
    seen.add(current)
    const role = map.get(current)
    if (!role) continue
    for (const key of role.permissions) if (!out.has(key)) out.set(key, current)
    queue.push(...(role.includes ?? []))
  }
  return out
}
