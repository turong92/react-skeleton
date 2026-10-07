import { useAuth, type AccountMe } from '@skeleton/auth'
import { useQuery } from '@tanstack/react-query'
import { accountApi } from './session'
import { tokenStore } from './tokenStore'

export const myProfileKey = ['account', 'me'] as const

/**
 * 내 프로필(`GET /account/me`) — 닉네임 · 꼬리표 · 이메일. 로그인했을 때만 읽는다.
 * 계정이 바뀌거나 로그아웃하면 서버 상태 캐시가 통째로 비워진다(`createQueryClient` + `onAccountChange`).
 */
export function useMyProfile() {
  const { status } = useAuth()
  return useQuery<AccountMe | null>({
    queryKey: myProfileKey,
    // 로그아웃 순간(서버 상태 캐시가 비워지며 관찰자가 다시 읽으려 할 때)에는 토큰이 이미 없다 — 보내면 401 오류 토스트만 뜬다
    queryFn: () => (tokenStore.get() ? accountApi.me() : Promise.resolve(null)),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  })
}
