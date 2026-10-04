import type { AuthPrincipal, DevLoginIdentity } from '../../api/types'

export function parseDevIdentity(value: string): DevLoginIdentity {
  const normalized = value.trim()
  if (normalized.includes('@')) return { email: normalized }
  if (normalized.startsWith('acc_')) return { accountId: normalized }
  return { username: normalized }
}

export function applyAuthHeaders(
  headers: Headers,
  accessToken: string,
  devLogin: DevLoginIdentity,
) {
  if (accessToken) {
    headers.set(
      'Authorization',
      accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`,
    )
    return
  }
  if (devLogin.accountId) headers.set('X-Dev-Account-Id', devLogin.accountId)
  if (devLogin.username) headers.set('X-Dev-Username', devLogin.username)
  if (devLogin.email) headers.set('X-Dev-Email', devLogin.email)
}

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
