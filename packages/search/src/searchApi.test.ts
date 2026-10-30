import { describe, expect, it } from 'vitest'
import { recordingClient } from './test/recordingClient'
import { createSearchApi } from './searchApi'

describe('createSearchApi paths', () => {
  it('searches with GET /search and a page envelope', async () => {
    const { client, calls } = recordingClient({})
    await createSearchApi(client).search({ q: '방끈' })
    expect(calls).toEqual([{ kind: 'page', path: '/search', request: { params: { q: '방끈' } } }])
  })

  it('sends types as one comma-separated value and only the conditions that were set', () => {
    const { client, calls } = recordingClient({})
    void createSearchApi(client).search({
      q: 'bag',
      types: ['note', 'product'],
      scope: undefined,
      sort: 'recent',
      page: 2,
      size: 20,
    })
    expect(calls).toEqual([
      {
        kind: 'page',
        path: '/search',
        request: { params: { q: 'bag', types: 'note,product', sort: 'recent', page: 2, size: 20 } },
      },
    ])
  })

  it('sends no types when none are picked (= every type)', () => {
    const { client, calls } = recordingClient({})
    void createSearchApi(client).search({ q: 'bag', types: [] })
    expect(calls[0].request).toEqual({ params: { q: 'bag' } })
  })

  it('honours a different base path (skeleton.search.http.base-path)', () => {
    const { client, calls } = recordingClient({})
    void createSearchApi(client, { basePath: '/find/' }).search({ q: 'ab' })
    expect(calls[0].path).toBe('/find')
  })
})
