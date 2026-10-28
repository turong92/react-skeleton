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
    /** `COUPON.ISSUE_CLOSED` - 발행 기간 밖 */
    issueClosed: string
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
    /** 줄 끝 링크 - 정의 한 건 화면으로 */
    details: string
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
    validFrom: string
    validFromHint: string
    issuePeriodLegend: string
    issueStartsAt: string
    issueEndsAt: string
    issuePeriodHint: string
    /** 입력 순서 오류 - 발행 기간 · 사용 기간 */
    issuePeriodOrder: string
    usePeriodOrder: string
    issueLimit: string
    perAccountLimit: string
    noLimit: string
    accountCoupons: string
    couponCaption: string
    revoke: (name: string) => string
    revokeButton: string
    noAccountCoupons: string
  }
  accountSearch: {
    label: string
    hint: string
    submit: string
    noResult: string
    failed: string
    results: string
    pick: (label: string) => string
    picked: string
    change: string
  }
  couponDetail: {
    /** 목록 행의 이름 링크 낭독 - 「○○ 자세히」 */
    open: (name: string) => string
    back: string
    notFound: string
    status: string
    benefit: string
    issuePeriod: string
    usePeriod: string
    validDays: (days: number) => string
    until: string
    from: string
    always: string
    noEnd: string
    stats: {
      title: string
      issued: string
      available: string
      reserved: string
      used: string
      expired: string
      revoked: string
      discountTotal: string
      noDiscount: string
    }
    issuedList: {
      title: string
      caption: string
      statusFilter: string
      all: string
      columns: {
        account: string
        status: string
        issuedAt: string
        expiresAt: string
        usedAt: string
        order: string
        actions: string
      }
      empty: string
      more: string
      revoke: (account: string) => string
    }
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
