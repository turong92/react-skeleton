import type { RewardsLabels } from './labels'

/** 기본 문구(영어) */
export const defaultRewardsLabels: RewardsLabels = {
  loading: 'Loading',
  loadFailed: 'Could not load this. Try again.',
  retry: 'Try again',
  attendance: {
    title: 'Daily check-in',
    checkIn: 'Check in',
    checkedToday: 'Checked in today',
    total: (days) => `${days} days in total`,
    streak: (days) => `${days}-day streak`,
    nextMilestone: (days, streak) =>
      streak ? `Next reward at a ${days}-day streak` : `Next reward at ${days} days in total`,
    noMilestone: 'No more milestones',
    rewarded: 'You received',
    monthDays: (count) => `${count} days this month`,
    notActive: 'This event has ended.',
  },
  invite: {
    title: 'Invite friends',
    description: 'Share your code. You both get a reward when a friend joins with it.',
    yourCode: 'Your invite code',
    copy: 'Copy code',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    invited: (count) => `${count} invited`,
    rewarded: (count) => `${count} rewarded`,
  },
  coupon: {
    available: 'Available',
    past: 'Used or expired',
    emptyAvailable: 'You have no coupons to use.',
    emptyPast: 'No used or expired coupons.',
    expiresAt: (date) => `Valid until ${date}`,
    noExpiry: 'No expiry',
    minAmount: (money) => `For payments of ${money} or more`,
    status: {
      AVAILABLE: 'Available',
      RESERVED: 'In use',
      USED: 'Used',
      EXPIRED: 'Expired',
      REVOKED: 'Withdrawn',
    },
    redeem: {
      label: 'Coupon code',
      hint: 'Enter a code to add the coupon to your wallet.',
      submit: 'Add coupon',
      success: 'Coupon added.',
      errors: {
        invalid: 'This code is not valid.',
        used: 'You have already used this code.',
        exhausted: 'This code has run out.',
        other: 'Could not add the coupon. Try again.',
      },
    },
    picker: {
      legend: 'Coupon',
      none: 'Do not use a coupon',
      originalPrice: 'Price',
      finalPrice: 'You pay',
      belowMinimum: (money) => `Needs a payment of ${money} or more`,
    },
    stage: {
      free: 'Free',
      percent: (value) => `${value}% off`,
      fixed: (money) => `${money} off`,
      max: (money) => `up to ${money}`,
      once: (benefit) => benefit,
      times: (count, benefit) => `${benefit} for ${count} payments`,
      every: (benefit) => `${benefit} every time`,
      first: (count, benefit) =>
        count === 1
          ? `${benefit} on the first payment`
          : `${benefit} on the first ${count} payments`,
      next: (count, benefit) =>
        count === 1 ? `${benefit} on the next payment` : `${benefit} on the next ${count} payments`,
      after: (benefit) => `${benefit} after that`,
      join: ', ',
    },
    currencySuffix: {},
  },
  point: {
    balance: 'Points',
    unit: 'P',
    expiringSoon: (amount, date) => `${amount} expire before ${date}`,
    history: 'Point history',
    emptyHistory: 'No point history yet.',
    kinds: { EARN: 'Earned', SPEND: 'Spent', EXPIRE: 'Expired', ADJUST: 'Adjusted' },
    expiresAt: (date) => `Expires ${date}`,
    loadMore: 'Show more',
  },
}
