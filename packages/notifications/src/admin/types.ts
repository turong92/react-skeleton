/** 공지 상태 - 서버 상태 기계(`DRAFT` → `SCHEDULED`/`SENDING` → `SENT`, 취소 · 실패) 그대로 */
export const BROADCAST_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'SENDING',
  'SENT',
  'CANCELLED',
  'FAILED',
] as const
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number]

/** 대상 - `kind` 는 서버의 `AudienceSource` 이름(`all` · `role` · `workspace` · 앱의 세그먼트), `param` 은 종류가 받는 값 */
export type BroadcastAudience = { kind: string; param?: string | null }

/** 대상 종류가 받는 값의 모양 - 서버 `AudienceSource.param` */
export type AudienceParam = 'NONE' | 'ROLE' | 'WORKSPACE' | 'TEXT'

/** `GET /options` - 화면이 칸을 만드는 재료. `push` 가 거짓이면 그 종류는 푸시로 갈 수 없다(푸시 칸 잠김) */
export type BroadcastOptions = {
  types: Array<{ type: string; advertising: boolean; push: boolean }>
  /** 알림함 말고 고를 수 있는 채널(`push` 등) */
  channels: string[]
  audiences: Array<{ kind: string; param: AudienceParam }>
}

export type Broadcast = {
  id: string
  status: BroadcastStatus
  type: string
  title: string
  body: string | null
  link: string | null
  /** 알림함 말고 고른 채널 */
  channels: string[]
  audience: BroadcastAudience
  scheduledAt: string | null
  /** 시작 때 센 예상 대상 수 - 아직 안 보냈으면 null */
  estimate: number | null
  /** 지금까지 알림 묶음으로 넘긴 사람 수 */
  recipients: number
  failureReason: string | null
  createdBy: string
  createdAt: string
  sentBy: string | null
  sendRequestedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  cancelledBy: string | null
  cancelledAt: string | null
}

export type PushStats = {
  queued: number
  delivered: number
  failed: number
  dropped: number
  /** 푸시를 눌러 연 사람 수 - 알림함 `read` 와 따로 센다 */
  opened: number
}

export type BroadcastStats = {
  /** 알림함 줄 수 · 읽음 수 - 서버가 모르면(`null`) 칸을 「-」 로 */
  inbox: { stored: number; read: number } | null
  channels: Record<string, PushStats | undefined>
}

export type BroadcastDetail = Broadcast & { stats: BroadcastStats }

/** `POST /` · `PUT /{id}` 본문 */
export type BroadcastInput = {
  type: string
  title: string
  body?: string | null
  link?: string | null
  channels: string[]
  audience: BroadcastAudience
}

export type BroadcastListQuery = { status?: BroadcastStatus; before?: string; limit?: number }
