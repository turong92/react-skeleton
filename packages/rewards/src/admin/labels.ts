import type { CouponDefinitionStatus, RewardGrantStatus } from './types'
import type { PointEntryKind } from '../types'

export type RewardsAdminLabels = {
  loading: string
  loadFailed: string
  retry: string
  save: string
  cancel: string
  close: string
  create: string
  edit: string
  remove: string
  yes: string
  errors: {
    insufficient: string
    notFound: string
    validation: string
    notEnabled: string
    generic: string
  }
  rewardEditor: {
    legend: string
    add: string
    type: string
    types: { point: string; coupon: string }
    amount: string
    expiresInDays: string
    definition: string
    remove: (n: number) => string
    none: string
  }
  stageEditor: {
    legend: string
    stage: (n: number) => string
    type: string
    types: { FREE: string; PERCENT: string; FIXED: string }
    value: string
    percentSuffix: string
    maxDiscount: string
    periods: string
    forever: string
    foreverOnlyLast: string
    add: string
    addLimit: (max: number) => string
    remove: (n: number) => string
    templates: string
    voucher: string
    freeMonths: (months: number) => string
    monthsLabel: string
    empty: string
  }
  campaigns: {
    title: string
    caption: string
    create: string
    createTitle: string
    editTitle: (name: string) => string
    empty: string
    columns: { name: string; kind: string; period: string; enabled: string; actions: string }
    kinds: { attendance: string; referral: string }
    enabledSwitch: (name: string) => string
    noEnd: string
    kind: string
    name: string
    startsAt: string
    endsAt: string
    endsAtHint: string
    attendance: {
      daily: string
      milestones: string
      addMilestone: string
      days: string
      streak: string
      total: string
      removeMilestone: (n: number) => string
    }
    referral: {
      invitee: string
      inviter: string
      qualifyOn: string
      qualifyClaim: string
      qualifySignal: string
      claimWithinDays: string
      inviterCap: string
      inviterCapHint: string
    }
  }
  coupons: {
    title: string
    caption: string
    create: string
    createTitle: string
    empty: string
    columns: {
      name: string
      benefit: string
      status: string
      issued: string
      actions: string
    }
    status: Record<CouponDefinitionStatus, string>
    setStatus: (name: string, status: string) => string
    issue: string
    issueTitle: (name: string) => string
    issueAccounts: string
    issueHint: string
    /** 줬거나 건너뛴 계정 수 - 건너뛴 계정은 한도 · 이미 가짐 같은 이유로 한 장도 안 갔다 */
    issuedResult: (issued: number, skipped: number) => string
    makeCode: string
    codeTitle: (name: string) => string
    codeBody: string
    name: string
    currency: string
    currencyHint: string
    minAmount: string
    scope: string
    scopeHint: string
    scopePurposes: string
    scopeItemTypes: string
    scopePlanCodes: string
    firstPurchaseOnly: string
    validDays: string
    validUntil: string
    issueLimit: string
    perAccountLimit: string
    noLimit: string
    accountCoupons: string
    accountId: string
    find: string
    couponCaption: string
    revoke: (name: string) => string
    revokeButton: string
    noAccountCoupons: string
  }
  points: {
    title: string
    accountId: string
    find: string
    balance: string
    history: string
    emptyHistory: string
    kinds: Record<PointEntryKind, string>
    adjust: string
    delta: string
    deltaHint: string
    reason: string
    expiresInDays: string
    expiresInDaysHint: string
    submit: string
    done: string
    unit: string
  }
  grants: {
    title: string
    caption: string
    empty: string
    statusFilter: string
    all: string
    status: Record<RewardGrantStatus, string>
    columns: {
      reward: string
      account: string
      status: string
      source: string
      created: string
      actions: string
    }
    retry: string
    retryFor: (label: string) => string
    cancel: string
    cancelFor: (label: string) => string
  }
}

export { defaultRewardsAdminLabels } from './labels.admin.en'
export { koRewardsAdminLabels } from './labels.admin.ko'
