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
    /** `COUPON.DEFINITION_INVALID` - 쿠폰 값 · 기간이 맞지 않다 */
    definitionInvalid: string
    /** `BADGE.CODE_TAKEN` - 같은 코드의 배지가 이미 있다 */
    codeTaken: string
    /** `BADGE.ARCHIVED` - 보관된 배지는 줄 수 없다 */
    badgeArchived: string
    notFound: string
    validation: string
    notEnabled: string
    generic: string
  }
  rewardEditor: {
    legend: string
    add: string
    type: string
    types: { point: string; coupon: string; badge: string }
    amount: string
    expiresInDays: string
    definition: string
    badge: string
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
    kinds: { attendance: string; referral: string; achievement: string }
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
    achievement: {
      metric: string
      metricHint: string
      steps: string
      addStep: string
      value: string
      removeStep: (n: number) => string
      errors: { metric: string; count: string; value: string; rewards: string }
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
  badges: {
    title: string
    caption: string
    create: string
    createTitle: string
    editTitle: (name: string) => string
    empty: string
    columns: { badge: string; holders: string; status: string; actions: string }
    status: { ACTIVE: string; ARCHIVED: string }
    hiddenTag: string
    code: string
    codeHint: string
    name: string
    description: string
    imageUrl: string
    imageUrlHint: string
    hidden: string
    hiddenHint: string
    sortOrder: string
    archive: string
    restore: string
    archiveFor: (name: string) => string
    restoreFor: (name: string) => string
    award: string
    awardFor: (name: string) => string
    awardTitle: (name: string) => string
    awardAccounts: string
    awardHint: string
    awardLimit: (max: number) => string
    reason: string
    reasonHint: string
    awardedResult: (awarded: number, alreadyHeld: number) => string
    /** 이미 가지고 있던 계정 이름들 - 「이미 가진 사람: a, b」 */
    alreadyHeldList: (names: string) => string
    /** 없는 계정이라 수여하지 않은 id - 「k명은 없는 계정이라 건너뜀: id, id」 */
    unknownAccountsList: (count: number, ids: string) => string
  }
  badgeAwards: {
    title: string
    caption: string
    empty: string
    badgeFilter: string
    allBadges: string
    accountFilter: string
    clearAccount: string
    columns: {
      when: string
      badge: string
      account: string
      action: string
      source: string
      reason: string
      actions: string
    }
    actions: { AWARDED: string; REVOKED: string }
    sources: { APP: string; ADMIN: string; GRANT: string }
    more: string
    revoke: string
    revokeFor: (badge: string, account: string) => string
    revokeTitle: string
    revokeReason: string
    revokeReasonHint: string
    deletedBadge: string
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
    /** 계정 조회 권한 · 계정 모듈이 없는 서버 - 검색이 403 · 404 */
    needsPermission: string
    /** 계정 모듈이 꺼진 서버(검색이 404) */
    toolOff: string
    /** 결과가 한도를 넘었다 */
    tooMany: string
  }
  couponDetail: {
    /** 목록 행의 이름 링크 낭독 - 「자세히: ○○」(보이는 글자로 시작) */
    open: (name: string) => string
    back: string
    notFound: string
    status: string
    benefit: string
    issuePeriod: string
    usePeriod: string
    validDays: (days: number) => string
    /** 「10월 1일까지」 · 「Until Oct 1」 - 인자는 서식을 입힌 시각 */
    until: (date: string) => string
    from: (date: string) => string
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
