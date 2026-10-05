import type { AuthPrincipal } from './types'

/** JWT payload 의 principal claim 을 서명 검증 없이 읽는다(화면 표시용). 읽을 수 없으면 null */
export function decodeTokenPrincipal(token: string): AuthPrincipal | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const json = JSON.parse(decodeBase64Url(payload)) as {
      sub?: string
      username?: string
      email?: string
      roles?: string[]
    }
    return {
      accountId: json.sub ?? '-',
      username: json.username ?? null,
      email: json.email ?? null,
      roles: json.roles ?? [],
    }
  } catch {
    return null
  }
}

function decodeBase64Url(value: string): string {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=')
  return atob(padded.replaceAll('-', '+').replaceAll('_', '/'))
}
