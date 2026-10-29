import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rewardsRoot } from '../queryKeys'
import type { BadgeApi } from './badgeApi'

export const badgeKeys = {
  all: [...rewardsRoot, 'badges'] as const,
  mine: () => [...badgeKeys.all, 'me'] as const,
  profile: (accountId: string) => [...badgeKeys.all, 'profile', accountId] as const,
}

/** 내 배지 — 받은 것과 아직인 것 */
export function useMyBadges(api: Pick<BadgeApi, 'myBadges'>) {
  return useQuery({ queryKey: badgeKeys.mine(), queryFn: () => api.myBadges() })
}

/** 프로필에 보이기 스위치 — 내 목록과 모든 공개 프로필 캐시를 다시 가져온다 */
export function useSetBadgeVisible(api: Pick<BadgeApi, 'setBadgeVisible'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ awardId, visible }: { awardId: string; visible: boolean }) =>
      api.setBadgeVisible(awardId, visible),
    onSuccess: () => client.invalidateQueries({ queryKey: badgeKeys.all }),
  })
}

/** 어떤 계정의 공개 프로필 배지 — 로그인 없이 부른다 */
export function useProfileBadges(api: Pick<BadgeApi, 'profileBadges'>, accountId: string) {
  return useQuery({
    queryKey: badgeKeys.profile(accountId),
    queryFn: () => api.profileBadges(accountId),
  })
}
