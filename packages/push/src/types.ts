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
  /** FCM 만 `android` · `ios` */
  platform: string | null
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
