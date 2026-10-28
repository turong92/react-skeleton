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

/**
 * 운영 목록 쿼리의 공통 옵션 - 다시 시도하지 않고, 404(그 모듈의 `admin.enabled` 가 꺼진 서버)는 오류 토스트로 알리지 않는다
 * (화면이 제자리에서 「서버에서 이 도구가 꺼져 있어요」라고 말한다 - 앱의 `createQueryClient` 가 `meta.quietStatuses` 를 읽는다)
 */
const LIST_OPTIONS = { retry: false, meta: { quietStatuses: [404] } } as const

export const useAdminCampaigns = (api: Pick<RewardsAdminApi, 'listCampaigns'>) =>
  useQuery({ queryKey: adminKeys.campaigns(), queryFn: () => api.listCampaigns(), ...LIST_OPTIONS })

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

export function adminCouponDefinitionsQuery(
  api: Pick<RewardsAdminApi, 'listCouponDefinitions'>,
  enabled = true,
) {
  return {
    queryKey: adminKeys.definitions(),
    queryFn: () => api.listCouponDefinitions(),
    enabled,
    ...LIST_OPTIONS,
  }
}

/** 쿠폰 정의 목록. 쿠폰 운영 권한이 없는 사람 화면(이벤트 운영이 쿠폰 이름을 고르려고 읽는다)에서는 `enabled: false` - 403 을 부르지 않는다 */
export const useAdminCouponDefinitions = (
  api: Pick<RewardsAdminApi, 'listCouponDefinitions'>,
  { enabled = true }: { enabled?: boolean } = {},
) => useQuery(adminCouponDefinitionsQuery(api, enabled))

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
    ...LIST_OPTIONS,
  })

export const useAccountPoints = (
  api: Pick<RewardsAdminApi, 'accountPoints'>,
  accountId: string | null,
) =>
  useQuery({
    queryKey: adminKeys.points(accountId ?? ''),
    queryFn: () => api.accountPoints(accountId as string),
    enabled: accountId !== null,
    ...LIST_OPTIONS,
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
    ...LIST_OPTIONS,
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
