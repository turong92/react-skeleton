import { mergeLabels } from '../labels'

export type AdvertisingLabels = {
  loading: string
  loadFailed: string
  retry: string
  title: string
  /** 보내는 사람 이름이 들어간 설명 — 동의 없이도 서비스를 쓸 수 있음을 밝힌다 */
  description: (senderName: string) => string
  consent: {
    title: string
    description: string
    /** 동의한 날짜 · 만료일 줄 */
    agreedUntil: (agreedAt: string, expiresAt: string) => string
    agree: string
    agreeFor: (title: string) => string
    /** 철회 · 만료 뒤 */
    stopped: string
  }
  night: {
    title: string
    description: (start: string, end: string, zone: string) => string
    /** 광고 수신에 동의해야 켤 수 있다 */
    locked: string
  }
  reconfirm: {
    dueTitle: (daysLeft: number) => string
    dueDescription: string
    dueAction: string
    expiredTitle: string
    expiredDescription: string
    expiredAction: string
    /** 여러 줄 중 어느 것인지 읽히도록 */
    actionFor: (action: string, title: string) => string
  }
  dialog: {
    close: string
    cancel: string
    /** 체크박스 — 처음에는 꺼져 있다 */
    check: string
    confirm: string
    loadingDocument: string
    documentFailed: string
    agreeFailed: string
  }
  withdraw: {
    title: string
    description: string
    /** 광고를 철회하는데 야간 동의가 남아 있을 때 덧붙인다 */
    alsoNight: string
    confirm: string
    cancel: string
    done: (when: string) => string
    failed: string
  }
}

export type AdvertisingLabelsInput = {
  [K in keyof AdvertisingLabels]?: AdvertisingLabels[K] extends (...args: never[]) => unknown
    ? AdvertisingLabels[K]
    : AdvertisingLabels[K] extends object
      ? Partial<AdvertisingLabels[K]>
      : AdvertisingLabels[K]
}

/** 기본 문구(영어) */
export const defaultAdvertisingLabels: AdvertisingLabels = {
  loading: 'Loading',
  loadFailed: 'Could not load your promotional notification settings.',
  retry: 'Try again',
  title: 'Promotional notifications',
  description: (sender) =>
    `Choose whether ${sender} may send you promotional push notifications. You can use the service either way.`,
  consent: {
    title: 'Receive promotional notifications',
    description: 'Offers and news. Off by default; you can withdraw at any time.',
    agreedUntil: (agreedAt, expiresAt) => `Agreed on ${agreedAt} · confirm again by ${expiresAt}`,
    agree: 'Agree',
    agreeFor: (title) => `${title}: agree`,
    stopped: 'You are not receiving promotional notifications.',
  },
  night: {
    title: 'Also receive them at night',
    description: (start, end, zone) =>
      `Promotional notifications between ${start} and ${end} (${zone}) need your separate consent.`,
    locked: 'Agree to promotional notifications first.',
  },
  reconfirm: {
    dueTitle: (days) => `Please confirm your consent (D-${days})`,
    dueDescription: 'Consent to promotional notifications is confirmed every two years.',
    dueAction: 'Confirm',
    expiredTitle: 'Your consent has expired, so you are not receiving promotional notifications',
    expiredDescription: 'Agree again to start receiving them.',
    expiredAction: 'Agree again',
    actionFor: (action, title) => `${title}: ${action}`,
  },
  dialog: {
    close: 'Close',
    cancel: 'Cancel',
    check: 'I have read this and agree',
    confirm: 'Agree and receive',
    loadingDocument: 'Loading the document',
    documentFailed: 'Could not load the document.',
    agreeFailed: 'Could not save your consent. Try again.',
  },
  withdraw: {
    title: 'Stop promotional notifications?',
    description: 'You will stop receiving them right away. You can agree again later.',
    alsoNight: 'Night notifications are turned off too.',
    confirm: 'Withdraw consent',
    cancel: 'Keep receiving',
    done: (when) => `Withdrawn (${when}).`,
    failed: 'Could not withdraw your consent. Try again.',
  },
}

/** 한국어 문구 */
export const koAdvertisingLabels: AdvertisingLabels = {
  loading: '불러오는 중',
  loadFailed: '광고성 정보 수신 설정을 불러오지 못했어요.',
  retry: '다시 시도',
  title: '광고성 정보 수신',
  description: (sender) =>
    `${sender}의 광고성 푸시 알림을 받을지 정해요. 동의하지 않아도 서비스는 그대로 이용할 수 있어요.`,
  consent: {
    title: '광고성 정보 수신',
    description: '이벤트 · 혜택 소식이에요. 처음에는 꺼져 있고, 언제든 철회할 수 있어요.',
    agreedUntil: (agreedAt, expiresAt) => `${agreedAt}에 동의 · ${expiresAt}까지 확인이 필요해요`,
    agree: '동의하기',
    agreeFor: (title) => `${title} 동의하기`,
    stopped: '광고성 알림을 받지 않고 있어요.',
  },
  night: {
    title: '야간(21~08시) 광고도 받기',
    description: (start, end, zone) =>
      `${start}~${end}(${zone}) 사이의 광고는 따로 동의해야 받을 수 있어요.`,
    locked: '광고성 정보 수신에 먼저 동의해 주세요.',
  },
  reconfirm: {
    dueTitle: (days) => `수신 동의를 확인해 주세요 (D-${days})`,
    dueDescription: '광고성 정보 수신 동의는 2년마다 다시 확인해요.',
    dueAction: '확인',
    expiredTitle: '동의가 만료되어 광고를 받지 않고 있어요',
    expiredDescription: '다시 동의하면 광고를 받기 시작해요.',
    expiredAction: '다시 동의',
    actionFor: (action, title) => `${title} ${action}`,
  },
  dialog: {
    close: '닫기',
    cancel: '취소',
    check: '위 내용을 읽었고 동의합니다',
    confirm: '동의하고 받기',
    loadingDocument: '문서를 불러오는 중',
    documentFailed: '문서를 불러오지 못했어요.',
    agreeFailed: '동의를 저장하지 못했어요. 다시 시도해 주세요.',
  },
  withdraw: {
    title: '광고성 알림을 그만 받을까요?',
    description: '바로 받지 않게 돼요. 나중에 다시 동의할 수 있어요.',
    alsoNight: '야간 수신도 함께 꺼져요.',
    confirm: '동의 철회',
    cancel: '계속 받기',
    done: (when) => `철회했어요 (${when}).`,
    failed: '철회하지 못했어요. 다시 시도해 주세요.',
  },
}

/** 기본 문구(영어) 위에 앱의 문구를 얹는다. 한국어는 `resolveAdvertisingLabels(koAdvertisingLabels)` */
export function resolveAdvertisingLabels(input: AdvertisingLabelsInput = {}): AdvertisingLabels {
  return mergeLabels<AdvertisingLabels>(defaultAdvertisingLabels, input)
}
