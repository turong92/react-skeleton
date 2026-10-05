import type { ApiClient } from '@skeleton/api-client'
import type { Note, NoteInput, NotesQuery, NoteSummary } from './types'

type NotesClient = Pick<ApiClient, 'value' | 'page' | 'noContent'>

/** 값이 있는 조건만 보낸다 — 빈 검색어 · 「전체」 상태는 서버에 아무 말도 하지 않는다 */
function paramsOf(query: NotesQuery) {
  const params: Record<string, unknown> = {}
  if (query.page !== undefined) params.page = query.page
  if (query.size !== undefined) params.size = query.size
  if (query.q) params.q = query.q
  if (query.status) params.status = query.status
  if (query.pinned !== undefined) params.pinned = query.pinned
  return params
}

/**
 * `/api/v1/notes` 호출 모음 — HTTP 는 이 파일 한 곳. 화면은 `queries.ts` 의 훅을 거친다.
 * 만들기는 `Idempotency-Key` 가 필수라 호출하는 쪽이 키를 준다(같은 폼 제출을 다시 보낼 때만 같은 키).
 */
export function createNotesApi(client: NotesClient) {
  const path = (id: string) => `/notes/${encodeURIComponent(id)}`
  return {
    list: (query: NotesQuery = {}) => client.page<Note>('/notes', { params: paramsOf(query) }),
    get: (id: string) => client.value<Note>(path(id)),
    summary: () => client.value<NoteSummary>('/notes/summary'),
    create: (input: NoteInput, idempotencyKey: string) =>
      client.value<Note>('/notes', {
        method: 'POST',
        idempotencyKey,
        json: { title: input.title, body: input.body, status: input.status, pinned: input.pinned },
      }),
    update: (id: string, input: NoteInput) =>
      client.value<Note>(path(id), { method: 'PUT', json: input }),
    /** 삭제는 204(본문 없음) */
    remove: (id: string) => client.noContent(path(id), { method: 'DELETE' }),
    /** 내보내기를 대기열에 넣는다(202). 끝나면 받은편지함에 알림이 온다 */
    startExport: (id: string) =>
      client.value<{ jobId: string }>(`${path(id)}/export`, { method: 'POST' }),
  }
}

export type NotesApi = ReturnType<typeof createNotesApi>
