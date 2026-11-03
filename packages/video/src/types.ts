/** 영상 한 줄의 주 상태 - `PLAYABLE` 은 원본 단이 올라간 순간이다(호환 · 사다리는 그 뒤 따로 만들어진다) */
export type VideoStatus =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'QUEUED'
  | 'REMUXING'
  | 'PLAYABLE'
  | 'FAILED'
  | 'DELETED'

/** 호환 단 · 사다리 트랙의 상태 - 트랙이 실패해도 재생은 계속된다 */
export type TrackStatus = 'NONE' | 'SKIPPED' | 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED'

export type VideoVisibility = 'PUBLIC' | 'PRIVATE'

/** 목록의 한 줄 - 설계 4절 `videos` 표에서 화면이 쓰는 것만 */
export type VideoItem = {
  id: string
  purpose: string
  visibility: VideoVisibility
  status: VideoStatus
  /** 올리기 시작 때 말한 파일 크기 */
  bytes: number
  /** 호환 단 상태 */
  compat: TrackStatus
  /** 사다리(아랫단) 상태 */
  ladder: TrackStatus
  /** 일꾼이 보고한 진행(0~100) - 아직 모르면 null */
  progress: number | null
  /** 실패 사유(`UNSUPPORTED_FORMAT` · `CORRUPT` · `LIMITS_EXCEEDED` · `TOO_BIG_FOR_WORKER` · `PROCESSING_FAILED` · `LEASE_EXPIRED` · `UPLOAD_ABANDONED`) - 실패가 아니면 null */
  failCode: string | null
  /** 재생 가능이 되기 전엔 null */
  width: number | null
  height: number | null
  durationMs: number | null
  createdAt: string
}

export type StartedVideo = { id: string; uploadId: string; partSize: number }

/** 서명된 조각 `PUT` 주소 - 응답 헤더의 `ETag` 를 모아 마치기에 보낸다 */
export type PartTarget = {
  number: number
  method: string
  url: string
  headers: Record<string, string>
}

/** 저장소에 이미 올라간 조각 - 이어 올리기에 쓴다 */
export type UploadedPart = { n: number; etag: string; bytes: number }

export type CompletedPart = { n: number; etag: string }

/** 재생 요청의 응답(`POST /videos/{id}/playback`) - 주소는 전부 서버가 정한 것이다 */
export type VideoPlayback = {
  /** 원본 단 재생 목록 */
  src: string
  /** 호환 단 재생 목록 - 아직 없으면 생략 */
  compat?: string
  /** 마스터(자동) 재생 목록 - 아직 없으면 생략 */
  hls?: string
  poster: string
  /** 원본 단 코덱 문자열(`hvc1.1.6.L153.B0` …) - 모르면 빈 글자 */
  codec: string
  w: number
  h: number
  durationMs: number
  /** 원본이 호환 조건 밖(4K 같은)이라 호환 단을 기본으로 삼아야 한다 */
  big: boolean
  /** 비공개 영상의 토큰 만료 시각(ISO) - 공개면 생략 */
  expiresAt?: string
}
