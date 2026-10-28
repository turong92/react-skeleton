import type { AdminAccountsApi } from '@skeleton/auth/admin'
import type { AccountChoice } from '@skeleton/rewards/admin'

const LIMIT = 10

/**
 * 쿠폰 운영의 계정 찾기 - 기존 `GET /admin/accounts?email=&loginId=` 를 쓴다(새 API 없음).
 * `@` 가 들어 있으면 이메일, 아니면 로그인 아이디(정확히 일치)와 이메일 조각 둘 다 물어 합친다.
 */
export function createAccountSearch(api: Pick<AdminAccountsApi, 'list'>) {
  return async function searchAccounts(query: string): Promise<AccountChoice[]> {
    const q = query.trim()
    if (q === '') return []
    const pages = await Promise.all(
      q.includes('@')
        ? [api.list({ email: q, size: LIMIT })]
        : [api.list({ loginId: q, size: LIMIT }), api.list({ email: q, size: LIMIT })],
    )
    const seen = new Set<string>()
    return pages
      .flatMap((page) => page.values)
      .filter((account) => (seen.has(account.id) ? false : (seen.add(account.id), true)))
      .map((account) => ({
        id: account.id,
        email: account.email,
        loginId: account.loginId ?? null,
      }))
  }
}
