import type { CouponStatus, PointEntryKind } from './types'
import { defaultRewardsLabels } from './labels.en'

export type RewardsLabels = {
  loading: string
  loadFailed: string
  retry: string
  attendance: {
    title: string
    checkIn: string
    checkedToday: string
    total: (days: number) => string
    streak: (days: number) => string
    /** `streak` 면 「연속 N일」, 아니면 「총 N일」 */
    nextMilestone: (days: number, streak: boolean) => string
    noMilestone: string
    rewarded: string
    monthDays: (count: number) => string
    notActive: string
  }
  invite: {
    title: string
    description: string
    yourCode: string
    copy: string
    copied: string
    copyFailed: string
    invited: (count: number) => string
    rewarded: (count: number) => string
  }
  coupon: {
    available: string
    past: string
    emptyAvailable: string
    emptyPast: string
    expiresAt: (date: string) => string
    noExpiry: string
    minAmount: (money: string) => string
    status: Record<CouponStatus, string>
    redeem: {
      label: string
      hint: string
      submit: string
      success: string
      errors: { invalid: string; used: string; exhausted: string; other: string }
    }
    picker: {
      legend: string
      none: string
      originalPrice: string
      finalPrice: string
      belowMinimum: (money: string) => string
    }
    stage: {
      free: string
      percent: (value: number) => string
      fixed: (money: string) => string
      /** 「최대 5,000원」 */
      max: (money: string) => string
      /** 한 단계, 한 번 — 「30% 할인」(무료는 그대로 「무료」) */
      once: (benefit: string, free: boolean) => string
      /** 한 단계, N 번 */
      times: (count: number, benefit: string) => string
      /** 한 단계, 영원히 */
      every: (benefit: string) => string
      /** 여러 단계 중 첫 단계 */
      first: (count: number, benefit: string) => string
      /** 여러 단계 중 이어지는 단계 */
      next: (count: number, benefit: string) => string
      /** 여러 단계의 영원한 끝 단계 */
      after: (benefit: string) => string
      /** 단계 문구 사이 */
      join: string
    }
    currencySuffix: Record<string, string>
  }
  point: {
    balance: string
    unit: string
    expiringSoon: (amount: string, date: string) => string
    history: string
    emptyHistory: string
    kinds: Record<PointEntryKind, string>
    expiresAt: (date: string) => string
    loadMore: string
  }
}

/** 앱이 준 일부 문구(안쪽도 일부만 가능) */
export type RewardsLabelsInput = {
  [K in keyof RewardsLabels]?: RewardsLabels[K] extends (...args: never[]) => unknown
    ? RewardsLabels[K]
    : RewardsLabels[K] extends object
      ? Partial<RewardsLabels[K]>
      : RewardsLabels[K]
}

export { defaultRewardsLabels } from './labels.en'
export { koRewardsLabels } from './labels.ko'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function merge<T>(base: T, over: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(over)) return (over === undefined ? base : over) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(over))
    if (value !== undefined) out[key] = merge(base[key], value)
  return out as T
}

export function resolveRewardsLabels(input: RewardsLabelsInput = {}): RewardsLabels {
  return merge<RewardsLabels>(defaultRewardsLabels, input)
}
