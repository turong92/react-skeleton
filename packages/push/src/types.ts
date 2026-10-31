/** `GET /push/config` — 화면이 구독에 쓸 공개 키와 서버가 켠 것 */
export type PushConfig = {
  /** 웹 푸시를 켜지 않은 서버는 null */
  webPush: { publicKey: string } | null
  /** 모바일(FCM) 발송이 켜져 있다 — 웹 화면은 쓰지 않는다 */
  fcm: boolean
  /** 푸시로 가는 알림 종류 */
  types: string[]
  /** 광고 푸시 종류(비어 있으면 광고 없음) — 동의 화면은 `@skeleton/push/advertising` */
  advertisingTypes: string[]
}

export type PushDeviceKind = 'WEBPUSH' | 'FCM'

export type PushDevice = {
  installationId: string
  kind: PushDeviceKind
  /** 웹 푸시는 `web`, FCM 은 `android` · `ios` */
  platform: string
  label: string | null
  createdAt: string
  lastSeenAt: string
}

/** 웹 기기 등록 본문 — `PUT /push/devices/{installationId}` */
export type WebPushRegistration = {
  kind: 'WEBPUSH'
  endpoint: string
  keys: { p256dh: string; auth: string }
  label?: string
}

/** 푸시 종류 한 줄 — `push` 는 이 종류의 푸시가 켜져 있다, `allChannelsMuted` 면 모든 채널을 끈 사람(읽기만) */
export type PushPreference = {
  type: string
  push: boolean
  allChannelsMuted: boolean
}

export type PushSupport = 'supported' | 'needs-install' | 'unsupported'

/** 광고 수신 동의 한 종류의 상태 — `GET /push/advertising` */
export type AdvertisingConsentState = 'AGREED' | 'EXPIRED' | 'OUTDATED' | 'WITHDRAWN' | 'NONE'

export type AdvertisingConsent = {
  /** `legal` 문서 종류(`marketing` · `marketing-night`) */
  type: string
  state: AdvertisingConsentState
  agreedAt: string | null
  expiresAt: string | null
  /** `AGREED` 이고 만료까지 안내 기간 이내 — 「확인」(재확인)을 받는다 */
  reconfirmDue: boolean
  /** 서버가 실제로 보낼 수 있다고 본다(야간은 광고 동의도 유효해야 true) */
  effective: boolean
}

/** `GET /push/advertising` — 광고 종류가 설정된 서버만 연다(없으면 404) */
export type PushAdvertising = {
  advertisingTypes: string[]
  senderName: string
  consent: AdvertisingConsent
  night: AdvertisingConsent
  nightWindow: { start: string; end: string; zone: string }
}
