import { describe, expect, it } from 'vitest'
import { recordingClient } from '../test/recordingClient'
import { createReviewsAdminApi } from './adminApi'

describe('createReviewsAdminApi paths (§A5 운영)', () => {
  it('lists the queue with GET /admin/reviews?queue=… and sends only the filters that were set', async () => {
    const { client, calls } = recordingClient({})
    await createReviewsAdminApi(client).listReviews({ queue: 'reported' })
    await createReviewsAdminApi(client).listReviews({
      queue: 'all',
      targetType: 'product',
      cursor: 'c1',
    })
    expect(calls).toEqual([
      { kind: 'cursor', path: '/admin/reviews', request: { params: { queue: 'reported' } } },
      {
        kind: 'cursor',
        path: '/admin/reviews',
        request: { params: { queue: 'all', targetType: 'product', cursor: 'c1' } },
      },
    ])
  })

  it('hides / restores with PUT /admin/reviews/{id}/moderation {status, reason}', async () => {
    const { client, calls } = recordingClient()
    const api = createReviewsAdminApi(client)
    await api.moderate('r/1', { status: 'HIDDEN', reason: '광고' })
    await api.moderate('r1', { status: 'PUBLISHED' })
    expect(calls).toEqual([
      {
        kind: 'noContent',
        path: '/admin/reviews/r%2F1/moderation',
        request: { method: 'PUT', json: { status: 'HIDDEN', reason: '광고' } },
      },
      {
        kind: 'noContent',
        path: '/admin/reviews/r1/moderation',
        request: { method: 'PUT', json: { status: 'PUBLISHED' } },
      },
    ])
  })

  it('dismisses the reports with POST …/{id}/reports/dismiss', async () => {
    const { client, calls } = recordingClient()
    await createReviewsAdminApi(client).dismissReports('r1')
    expect(calls).toEqual([
      {
        kind: 'noContent',
        path: '/admin/reviews/r1/reports/dismiss',
        request: { method: 'POST' },
      },
    ])
  })

  it('writes the one reply with PUT …/{id}/reply {body} and removes it with DELETE', async () => {
    const { client, calls } = recordingClient()
    const api = createReviewsAdminApi(client)
    await api.setReply('r1', '감사합니다')
    await api.removeReply('r1')
    expect(calls).toEqual([
      {
        kind: 'noContent',
        path: '/admin/reviews/r1/reply',
        request: { method: 'PUT', json: { body: '감사합니다' } },
      },
      { kind: 'noContent', path: '/admin/reviews/r1/reply', request: { method: 'DELETE' } },
    ])
  })

  it('basePath is configurable', async () => {
    const { client, calls } = recordingClient({})
    await createReviewsAdminApi(client, { basePath: '/ops/reviews/' }).listReviews({
      queue: 'hidden',
    })
    expect(calls[0]?.path).toBe('/ops/reviews')
  })
})
