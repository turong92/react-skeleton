import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rewardsRoot } from '../queryKeys'
import type { CampaignApi } from './campaignApi'

export const campaignKeys = {
  all: [...rewardsRoot, 'campaigns'] as const,
  list: () => [...campaignKeys.all, 'list'] as const,
  month: (campaignId: string, month: string) =>
    [...campaignKeys.all, 'month', campaignId, month] as const,
  referral: () => [...rewardsRoot, 'referral'] as const,
}

/** 진행 중인 이벤트와 내 상태 */
export function useCampaigns(api: Pick<CampaignApi, 'listCampaigns'>) {
  return useQuery({ queryKey: campaignKeys.list(), queryFn: () => api.listCampaigns() })
}

/** 출석 이벤트 하나 — `data` 는 그 이벤트(없으면 undefined). 목록 캐시를 같이 쓴다 */
export function useAttendance(api: Pick<CampaignApi, 'listCampaigns'>, campaignId: string) {
  return useQuery({
    queryKey: campaignKeys.list(),
    queryFn: () => api.listCampaigns(),
    select: (campaigns) => campaigns.find((c) => c.id === campaignId),
  })
}

/** 한 달의 출석한 날(`month` = `2026-10`) */
export function useAttendanceMonth(
  api: Pick<CampaignApi, 'attendanceMonth'>,
  campaignId: string,
  month: string,
) {
  return useQuery({
    queryKey: campaignKeys.month(campaignId, month),
    queryFn: () => api.attendanceMonth(campaignId, month),
  })
}

/** 출석 — 성공하면 이벤트 · 달력 · 포인트 · 쿠폰함을 다시 가져온다(보상이 들어왔을 수 있다). 끝난 이벤트(409)는 호출한 쪽이 `onError` 로 */
export function useCheckIn(api: Pick<CampaignApi, 'checkIn'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (campaignId: string) => api.checkIn(campaignId),
    onSuccess: () => client.invalidateQueries({ queryKey: rewardsRoot }),
  })
}

/** 내 초대 코드와 초대 현황 */
export function useReferral(api: Pick<CampaignApi, 'myReferral'>) {
  return useQuery({ queryKey: campaignKeys.referral(), queryFn: () => api.myReferral() })
}

/** 초대 코드로 가입 — 보통 `useReferralCapture` 가 부른다 */
export function useClaimReferral(api: Pick<CampaignApi, 'claimReferral'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api.claimReferral(code),
    onSuccess: () => client.invalidateQueries({ queryKey: rewardsRoot }),
  })
}
