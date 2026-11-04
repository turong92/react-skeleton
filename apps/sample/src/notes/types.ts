/** 백엔드 `apps/sample` 의 노트(kotlin-skeleton `NoteResponse`). 시각은 ISO-8601 `...Z` */
export const NOTE_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const
export type NoteStatus = (typeof NOTE_STATUSES)[number]

export type Note = {
  id: string
  title: string
  body: string
  status: NoteStatus
  pinned: boolean
  attachmentKey: string | null
  attachmentName: string | null
  /** 붙은 영상(`@skeleton/video`, 목적 `note` · 비공개) - 없으면 null */
  videoId: string | null
  createdAt: string
  updatedAt: string
}

/** 만들기 · 고치기 본문 — 만들 때는 첨부 · 영상 칸을 보내지 않는다(상세 화면에서 올린 뒤 고친다). **고치기(PUT)는 노트를 통째로 바꾼다**: 칸을 빼면 첨부 · 영상이 떨어진다 — 늘 `noteInputOf` 로 만든다 */
export type NoteInput = {
  title: string
  body: string
  status: NoteStatus
  pinned: boolean
  attachmentKey: string | null
  attachmentName: string | null
  videoId: string | null
}

/** `GET /notes/summary` */
export type NoteSummary = {
  total: number
  pinned: number
  withAttachment: number
  draft: number
  active: number
  archived: number
}

/** 목록 조건 — 화면 주소의 검색 인자와 같은 모양(`page` 는 0 부터) */
export type NotesQuery = {
  page?: number
  size?: number
  q?: string
  status?: NoteStatus | ''
  pinned?: boolean
}

/** 백엔드 `NOTES.*` 코드(apps/sample 의 `NoteErrorCode`) — 이 앱의 것이라 패키지 `ErrorCodes` 가 아니라 여기에 둔다 */
export const NoteErrorCodes = { NOT_FOUND: 'NOTES.NOT_FOUND' } as const
