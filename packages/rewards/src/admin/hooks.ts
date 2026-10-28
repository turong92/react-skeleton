import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rewardsRoot } from '../queryKeys'
import type { RewardsAdminApi } from './adminApi'
import type {
  CampaignInput,
  CampaignUpdate,
  CouponDefinitionInput,
  CouponDefinitionStatus,
  PointAdjustment,
  RewardGrantStatus,
} from './types'

export const adminKeys = {
  all: [...rewardsRoot, 'admin'] as const,
  campaigns: () => [...adminKeys.all, 'campaigns'] as const,
  definitions: () => [...adminKeys.all, 'coupon-definitions'] as const,
  accountCoupons: (accountId: string) => [...adminKeys.all, 'coupons', accountId] as const,
  points: (accountId: string) => [...adminKeys.all, 'points', accountId] as const,
  grants: (status: RewardGrantStatus | '') => [...adminKeys.all, 'grants', status] as const,
}

export const useAdminCampaigns = (api: Pick<RewardsAdminApi, 'listCampaigns'>) =>
  useQuery({ queryKey: adminKeys.campaigns(), queryFn: () => api.listCampaigns(), retry: false })

/** 만들기 · 고치기 · 켜고 끄기 - 성공하면 목록을 다시 읽는다 */
export function useCampaignMutations(
  api: Pick<RewardsAdminApi, 'createCampaign' | 'updateCampaign' | 'setCampaignEnabled'>,
) {
  const client = useQueryClient()
  const done = () => client.invalidateQueries({ queryKey: rewardsRoot })
  return {
    create: useMutation({
      mutationFn: (input: CampaignInput) => api.createCampaign(input),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: CampaignUpdate }) => api.updateCampaign(v.id, v.input),
      onSuccess: done,
    }),
    setEnabled: useMutation({
      mutationFn: (v: { id: string; enabled: boolean }) => api.setCampaignEnabled(v.id, v.enabled),
      onSuccess: done,
    }),
  }
}

export const useAdminCouponDefinitions = (api: Pick<RewardsAdminApi, 'listCouponDefinitions'>) =>
  useQuery({
    queryKey: adminKeys.definitions(),
    queryFn: () => api.listCouponDefinitions(),
    retry: false,
  })

export function useCouponDefinitionMutations(
  api: Pick<
    RewardsAdminApi,
    | 'createCouponDefinition'
    | 'setCouponDefinitionStatus'
    | 'issueCoupons'
    | 'createCouponCode'
    | 'revokeCoupon'
  >,
) {
  const client = useQueryClient()
  const done = () => client.invalidateQueries({ queryKey: rewardsRoot })
  return {
    create: useMutation({
      mutationFn: (input: CouponDefinitionInput) => api.createCouponDefinition(input),
      onSuccess: done,
    }),
    setStatus: useMutation({
      mutationFn: (v: { id: string; status: CouponDefinitionStatus }) =>
        api.setCouponDefinitionStatus(v.id, v.status),
      onSuccess: done,
    }),
    issue: useMutation({
      mutationFn: (v: { id: string; accountIds: string[] }) => api.issueCoupons(v.id, v.accountIds),
      onSuccess: done,
    }),
    code: useMutation({ mutationFn: (id: string) => api.createCouponCode(id) }),
    revoke: useMutation({ mutationFn: (id: string) => api.revokeCoupon(id), onSuccess: done }),
  }
}

export const useAccountCoupons = (
  api: Pick<RewardsAdminApi, 'listAccountCoupons'>,
  accountId: string | null,
) =>
  useQuery({
    queryKey: adminKeys.accountCoupons(accountId ?? ''),
    queryFn: () => api.listAccountCoupons(accountId as string),
    enabled: accountId !== null,
    retry: false,
  })

export const useAccountPoints = (
  api: Pick<RewardsAdminApi, 'accountPoints'>,
  accountId: string | null,
) =>
  useQuery({
    queryKey: adminKeys.points(accountId ?? ''),
    queryFn: () => api.accountPoints(accountId as string),
    enabled: accountId !== null,
    retry: false,
  })

/** 조정 - 성공하면 잔액과 내역(사용자 화면 포함)을 다시 읽는다. 잔액이 모자라면 409 `POINT.INSUFFICIENT` */
export function useAdjustPoints(api: Pick<RewardsAdminApi, 'adjustPoints'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (v: { accountId: string; input: PointAdjustment }) =>
      api.adjustPoints(v.accountId, v.input),
    onSuccess: () => client.invalidateQueries({ queryKey: rewardsRoot }),
  })
}

export const useRewardGrants = (
  api: Pick<RewardsAdminApi, 'listRewardGrants'>,
  status: RewardGrantStatus | '',
) =>
  useQuery({
    queryKey: adminKeys.grants(status),
    queryFn: () => api.listRewardGrants(status === '' ? undefined : status),
    retry: false,
  })

export function useRewardGrantMutations(
  api: Pick<RewardsAdminApi, 'retryRewardGrant' | 'cancelRewardGrant'>,
) {
  const client = useQueryClient()
  const done = () => client.invalidateQueries({ queryKey: rewardsRoot })
  return {
    retry: useMutation({ mutationFn: (id: string) => api.retryRewardGrant(id), onSuccess: done }),
    cancel: useMutation({ mutationFn: (id: string) => api.cancelRewardGrant(id), onSuccess: done }),
  }
}
