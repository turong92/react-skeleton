import type { ApiClient, ApiPageResponse } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createNotesApi } from './notesApi'
import type { Note, NoteInput } from './types'

type Call = { method: string; path: string; request?: Record<string, unknown> }

/** 요청만 기록하는 가짜 클라이언트 — 경로 · 메서드 · 본문이 백엔드 계약(`/api/v1/notes`)과 같은지 본다 */
function fakeClient(reply: unknown = {}) {
  const calls: Call[] = []
  const record =
    (method?: string) =>
    async (path: string, request: Record<string, unknown> = {}) => {
      calls.push({ method: (request.method as string) ?? method ?? 'GET', path, request })
      return reply
    }
  const client = {
    value: record(),
    page: record('GET'),
    noContent: async (path: string, request: Record<string, unknown> = {}) => {
      calls.push({ method: (request.method as string) ?? 'GET', path, request })
    },
  } as unknown as Pick<ApiClient, 'value' | 'page' | 'noContent'>
  return { client, calls }
}

const input: NoteInput = {
  title: '장보기',
  body: '우유, 달걀',
  status: 'DRAFT',
  pinned: false,
  attachmentKey: null,
  attachmentName: null,
}

describe('createNotesApi', () => {
  it('lists with only the filters that are set (empty search / status are not sent)', async () => {
    const { client, calls } = fakeClient({ values: [], pagination: {}, meta: {} })
    await createNotesApi(client).list({ page: 2, size: 10, q: '', status: '', pinned: undefined })
    await createNotesApi(client).list({ q: '회의', status: 'ACTIVE', pinned: true })
    expect(calls[0]).toMatchObject({ path: '/notes', request: { params: { page: 2, size: 10 } } })
    expect(calls[1].request?.params).toEqual({ q: '회의', status: 'ACTIVE', pinned: true })
  })

  it('creates with POST /notes, the draft fields only, and the caller-supplied Idempotency-Key', async () => {
    const { client, calls } = fakeClient({ id: 'n1' })
    await createNotesApi(client).create(input, 'key-1')
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/notes' })
    expect(calls[0].request).toMatchObject({
      idempotencyKey: 'key-1',
      json: { title: '장보기', body: '우유, 달걀', status: 'DRAFT', pinned: false },
    })
    expect(calls[0].request?.json).not.toHaveProperty('attachmentKey')
  })

  it('updates with PUT /notes/{id} carrying the whole note including the attachment', async () => {
    const { client, calls } = fakeClient()
    await createNotesApi(client).update('n 1', {
      ...input,
      attachmentKey: 'k',
      attachmentName: 'a.pdf',
    })
    expect(calls[0]).toMatchObject({ method: 'PUT', path: '/notes/n%201' })
    expect(calls[0].request?.json).toMatchObject({ attachmentKey: 'k', attachmentName: 'a.pdf' })
  })

  it('reads one, the summary, deletes and starts an export on the documented paths', async () => {
    const { client, calls } = fakeClient()
    const api = createNotesApi(client)
    await api.get('n1')
    await api.summary()
    await api.remove('n1')
    await api.startExport('n1')
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /notes/n1',
      'GET /notes/summary',
      'DELETE /notes/n1',
      'POST /notes/n1/export',
    ])
  })

  it('returns the page envelope untouched', async () => {
    const page: ApiPageResponse<Note> = {
      values: [],
      pagination: {
        page: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
      meta: { timestamp: 't' },
    }
    const { client } = fakeClient(page)
    await expect(createNotesApi(client).list()).resolves.toBe(page)
  })
})
