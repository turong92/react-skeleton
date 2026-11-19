import { ApiRequestError } from '@skeleton/api-client'
import type { BroadcastAdminApi } from '../adminApi'
import type {
  Broadcast,
  BroadcastDetail,
  BroadcastInput,
  BroadcastOptions,
  BroadcastStats,
} from '../types'

export const fakeOptions: BroadcastOptions = {
  types: [
    { type: 'notice.service', advertising: false, push: true },
    { type: 'notice.policy', advertising: false, push: false },
    { type: 'promo.notes-tips', advertising: true, push: true },
  ],
  channels: ['push'],
  audiences: [
    { kind: 'all', param: 'NONE' },
    { kind: 'role', param: 'ROLE' },
    { kind: 'workspace', param: 'WORKSPACE' },
  ],
}

const base = (
  over: Partial<Broadcast> & Pick<Broadcast, 'id' | 'status' | 'title'>,
): Broadcast => ({
  type: 'notice.service',
  body: null,
  link: null,
  channels: ['push'],
  audience: { kind: 'all', param: null },
  scheduledAt: null,
  estimate: null,
  recipients: 0,
  failureReason: null,
  createdBy: 'acc_admin',
  createdAt: '2026-11-01T01:00:00Z',
  sentBy: null,
  sendRequestedAt: null,
  startedAt: null,
  finishedAt: null,
  cancelledBy: null,
  cancelledAt: null,
  ...over,
})

export const fakeBroadcasts: Broadcast[] = [
  base({
    id: 'bc_sent',
    status: 'SENT',
    title: '정기 점검 안내',
    body: '내일 02:00~03:00 점검이 있어요.',
    link: '/status',
    estimate: 120,
    recipients: 120,
    sentBy: 'acc_admin',
    sendRequestedAt: '2026-11-01T02:00:00Z',
    startedAt: '2026-11-01T02:00:05Z',
    finishedAt: '2026-11-01T02:01:00Z',
  }),
  base({
    id: 'bc_sending',
    status: 'SENDING',
    title: '새 기능 소개',
    audience: { kind: 'role', param: 'USER' },
    estimate: 200,
    recipients: 80,
    sentBy: 'acc_admin',
    sendRequestedAt: '2026-11-02T00:00:00Z',
    startedAt: '2026-11-02T00:00:05Z',
  }),
  base({
    id: 'bc_scheduled',
    status: 'SCHEDULED',
    title: '연말 이용 안내',
    scheduledAt: '2026-12-24T01:00:00Z',
    estimate: 150,
    sentBy: 'acc_admin',
    sendRequestedAt: '2026-11-02T00:10:00Z',
  }),
  base({ id: 'bc_draft', status: 'DRAFT', title: '작성 중인 공지', body: '초안' }),
  base({
    id: 'bc_failed',
    status: 'FAILED',
    title: '요금제 변경',
    estimate: 300,
    recipients: 120,
    failureReason: 'TimeoutException',
    sentBy: 'acc_admin',
    sendRequestedAt: '2026-10-30T00:00:00Z',
    startedAt: '2026-10-30T00:00:05Z',
  }),
  base({
    id: 'bc_cancelled',
    status: 'CANCELLED',
    title: '취소한 공지',
    estimate: 50,
    recipients: 10,
    sentBy: 'acc_admin',
    sendRequestedAt: '2026-10-29T00:00:00Z',
    cancelledBy: 'acc_admin',
    cancelledAt: '2026-10-29T00:00:30Z',
  }),
]

const statsOf = (b: Broadcast): BroadcastStats => ({
  inbox: b.recipients > 0 ? { stored: b.recipients, read: Math.floor(b.recipients / 4) } : null,
  channels:
    b.channels.includes('push') && b.recipients > 0
      ? {
          push: {
            queued: b.recipients,
            delivered: Math.floor(b.recipients * 0.9),
            failed: 2,
            dropped: 3,
            opened: Math.floor(b.recipients / 5),
          },
        }
      : {},
})

const failure = (status: number, code: string) =>
  new ApiRequestError(
    { code, title: code, status, timestamp: '2026-11-02T00:00:00Z' },
    'trace',
    'span',
    'traceparent',
  )

/**
 * 스토리 · 시험용 메모리 안의 가짜 공지 운영 API. `calls` 는 부른 동작(`create` · `send:bc_1` …)을 순서대로 기록한다 -
 * 「확인 창을 거치기 전에는 안 보냈다」 같은 것을 play 에서 확인한다. 대상 수는 늘 3
 */
export function createFakeBroadcastAdmin(seed: Broadcast[] = fakeBroadcasts) {
  let rows = seed.map((b) => ({ ...b }))
  let next = 1
  const calls: string[] = []
  const find = (id: string) => {
    const row = rows.find((b) => b.id === id)
    if (!row) throw failure(404, 'BROADCAST.NOT_FOUND')
    return row
  }
  const change = (id: string, from: Broadcast['status'][], patch: Partial<Broadcast>) => {
    const row = find(id)
    if (!from.includes(row.status)) throw failure(409, 'BROADCAST.INVALID_STATE')
    Object.assign(row, patch)
  }
  const api: BroadcastAdminApi = {
    options: async () => fakeOptions,
    audienceCount: async () => ({ count: 3 }),
    list: async ({ status } = {}) => rows.filter((b) => !status || b.status === status),
    get: async (id): Promise<BroadcastDetail> => {
      const row = find(id)
      return { ...row, stats: statsOf(row) }
    },
    create: async (input: BroadcastInput) => {
      calls.push('create')
      const row = base({
        id: `bc_new${next++}`,
        status: 'DRAFT',
        ...input,
        body: input.body ?? null,
        link: input.link ?? null,
        audience: { kind: input.audience.kind, param: input.audience.param ?? null },
      })
      rows = [row, ...rows]
      return row
    },
    update: async (id, input) => {
      calls.push(`update:${id}`)
      change(id, ['DRAFT'], { ...input, body: input.body ?? null, link: input.link ?? null })
      return find(id)
    },
    remove: async (id) => {
      calls.push(`remove:${id}`)
      find(id)
      rows = rows.filter((b) => b.id !== id)
    },
    sendTest: async (id) => {
      calls.push(`test:${id}`)
      find(id)
    },
    send: async (id, scheduledAt) => {
      calls.push(`send:${id}`)
      change(id, ['DRAFT'], {
        status: scheduledAt ? 'SCHEDULED' : 'SENT',
        scheduledAt: scheduledAt ?? null,
        estimate: 3,
        recipients: scheduledAt ? 0 : 3,
        sentBy: 'acc_admin',
        sendRequestedAt: '2026-11-02T03:00:00Z',
      })
    },
    unschedule: async (id) => {
      calls.push(`unschedule:${id}`)
      change(id, ['SCHEDULED'], { status: 'DRAFT', scheduledAt: null })
    },
    cancel: async (id) => {
      calls.push(`cancel:${id}`)
      change(id, ['SCHEDULED', 'SENDING'], {
        status: 'CANCELLED',
        cancelledBy: 'acc_admin',
        cancelledAt: '2026-11-02T03:05:00Z',
      })
    },
    resume: async (id) => {
      calls.push(`resume:${id}`)
      change(id, ['FAILED'], { status: 'SENDING', failureReason: null })
    },
  }
  return { api, calls }
}
