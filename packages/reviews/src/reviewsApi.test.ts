import { describe, expect, it } from 'vitest'
import { recordingClient } from './test/recordingClient'
import { createReviewsApi } from './reviewsApi'

const target = { type: 'product', id: 'a/b' }

describe('createReviewsApi paths', () => {
  it('reads the config with GET /reviews/config', async () => {
    const { client, calls } = recordingClient({})
    await createReviewsApi(client).getConfig()
    expect(calls).toEqual([{ kind: 'value', path: '/reviews/config', request: undefined }])
  })

  it('reads one target summary with GET /reviews/targets/{type}/{id}/summary (id escaped)', async () => {
    const { client, calls } = recordingClient({})
    await createReviewsApi(client).getSummary(target)
    expect(calls).toEqual([
      { kind: 'value', path: '/reviews/targets/product/a%2Fb/summary', request: undefined },
    ])
  })

  it('reads many summaries with one GET /reviews/summaries?targets=type:id,type:id', async () => {
    const { client, calls } = recordingClient([])
    await createReviewsApi(client).listSummaries([
      { type: 'product', id: 'a' },
      { type: 'product', id: 'b' },
    ])
    expect(calls).toEqual([
      {
        kind: 'list',
        path: '/reviews/summaries',
        request: { params: { targets: 'product:a,product:b' } },
      },
    ])
  })

  it('lists reviews with GET …/reviews and sends only the filters that were set', async () => {
    const { client, calls } = recordingClient({})
    await createReviewsApi(client).listReviews(target, {
      sort: 'helpful',
      rating: 4,
      verified: true,
      photo: undefined,
      page: 0,
    })
    expect(calls).toEqual([
      {
        kind: 'page',
        path: '/reviews/targets/product/a%2Fb/reviews',
        request: { params: { sort: 'helpful', rating: 4, verified: true, page: 0 } },
      },
    ])
  })

  it('writes with POST …/reviews and an Idempotency-Key (a retry may pass the same one)', async () => {
    const { client, calls } = recordingClient({})
    const api = createReviewsApi(client)
    await api.createReview(
      target,
      { rating: 5, body: 'nice', photos: ['k1'] },
      {
        idempotencyKey: 'key-1',
      },
    )
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/reviews/targets/product/a%2Fb/reviews',
        request: {
          method: 'POST',
          json: { rating: 5, body: 'nice', photos: ['k1'] },
          idempotencyKey: 'key-1',
        },
      },
    ])
  })

  it('creates a fresh Idempotency-Key when the caller gives none', async () => {
    const { client, calls } = recordingClient({})
    await createReviewsApi(client).createReview(target, { rating: 5, body: 'x' })
    expect(calls[0].request?.idempotencyKey).toEqual(expect.any(String))
  })

  it('edits with PATCH /reviews/{id} and deletes with DELETE /reviews/{id}', async () => {
    const { client, calls } = recordingClient({})
    const api = createReviewsApi(client)
    await api.updateReview('r 1', { body: 'changed' })
    await api.removeReview('r 1')
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/reviews/r%201',
        request: { method: 'PATCH', json: { body: 'changed' } },
      },
      { kind: 'noContent', path: '/reviews/r%201', request: { method: 'DELETE' } },
    ])
  })

  it('toggles helpful with PUT / DELETE /reviews/{id}/helpful', async () => {
    const { client, calls } = recordingClient({ helpfulCount: 1, helpful: true })
    const api = createReviewsApi(client)
    await api.setHelpful('r1', true)
    await api.setHelpful('r1', false)
    expect(calls).toEqual([
      { kind: 'value', path: '/reviews/r1/helpful', request: { method: 'PUT' } },
      { kind: 'value', path: '/reviews/r1/helpful', request: { method: 'DELETE' } },
    ])
  })

  it('reports with POST /reviews/{id}/reports {reason, detail}', async () => {
    const { client, calls } = recordingClient()
    await createReviewsApi(client).reportReview('r1', { reason: 'SPAM', detail: 'ad' })
    expect(calls).toEqual([
      {
        kind: 'noContent',
        path: '/reviews/r1/reports',
        request: { method: 'POST', json: { reason: 'SPAM', detail: 'ad' } },
      },
    ])
  })

  it('reads my reviews with GET /reviews/me?cursor — the first page has no cursor', async () => {
    const { client, calls } = recordingClient({})
    const api = createReviewsApi(client)
    await api.myReviews()
    await api.myReviews('c1')
    expect(calls).toEqual([
      { kind: 'cursor', path: '/reviews/me', request: { params: {} } },
      { kind: 'cursor', path: '/reviews/me', request: { params: { cursor: 'c1' } } },
    ])
  })

  it('gives the photo address as a path — the server answers 302 to a short signed address', () => {
    const { client } = recordingClient()
    expect(createReviewsApi(client).photoPath('r 1', 2)).toBe('/reviews/r%201/photos/2')
  })

  it('takes the base path from the app', async () => {
    const { client, calls } = recordingClient({})
    await createReviewsApi(client, { basePath: '/x/reviews/' }).getConfig()
    expect(calls[0].path).toBe('/x/reviews/config')
  })
})
