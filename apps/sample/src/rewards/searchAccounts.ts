import type { AdminAccountsApi } from '@skeleton/auth/admin'
import type { AccountChoice } from '@skeleton/rewards/admin'

/** 한 번에 보이는 결과 수 - 하나 더 가져와 넘치는지(`AccountSearch` 의 「더 좁혀 주세요」)를 알린다 */
export const SEARCH_LIMIT = 10

/**
 * 쿠폰 · 포인트 운영의 계정 찾기 - 기존 `GET /admin/accounts?email=&loginId=` 를 쓴다(새 API 없음). 계정 조회 권한(`account.read`)이 필요하다.
 * `@` 가 들어 있으면 이메일, 아니면 로그인 아이디(정확히 일치)와 이메일 조각 둘 다 물어 합친다.
 * 서버가 그 필터를 모르면(로그인 아이디를 안 켠 서버는 `loginId` 를 무시하고 아무 계정이나 준다) 엉뚱한 계정이 섞이므로,
 * 돌아온 줄을 질의와 맞는 것만 남긴다(대소문자 무시).
 */
export function createAccountSearch(api: Pick<AdminAccountsApi, 'list'>) {
  return async function searchAccounts(query: string): Promise<AccountChoice[]> {
    const q = query.trim().toLowerCase()
    if (q === '') return []
    const size = SEARCH_LIMIT + 1
    const byEmail = (a: { email: string | null }) => a.email?.toLowerCase().includes(q) ?? false
    const byLoginId = (a: { loginId?: string | null }) => a.loginId?.toLowerCase() === q
    const pages = await Promise.all(
      q.includes('@')
        ? [api.list({ email: q, size }).then((page) => page.values.filter(byEmail))]
        : [
            api.list({ loginId: q, size }).then((page) => page.values.filter(byLoginId)),
            api.list({ email: q, size }).then((page) => page.values.filter(byEmail)),
          ],
    )
    const seen = new Set<string>()
    return pages
      .flat()
      .filter((account) => (seen.has(account.id) ? false : (seen.add(account.id), true)))
      .slice(0, size)
      .map((account) => ({
        id: account.id,
        email: account.email,
        loginId: account.loginId ?? null,
      }))
  }
}
