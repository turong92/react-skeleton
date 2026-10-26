import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createDashboardApi } from './api'

function fakeClient() {
  const calls: { path: string; request?: ApiRequest }[] = []
  return {
    calls,
    client: {
      value: async <T>(path: string, request?: ApiRequest) => {
        calls.push({ path, request })
        return {} as T
      },
    },
  }
}

describe('createDashboardApi (kotlin-skeleton docs/dashboard-http-contract.md)', () => {
  it('overview → GET /admin/dashboard?from&to&compare', async () => {
    const { client, calls } = fakeClient()
    await createDashboardApi(client).overview({ from: '2026-10-20', to: '2026-10-26' }, true)
    expect(calls).toEqual([
      {
        path: '/admin/dashboard',
        request: { params: { from: '2026-10-20', to: '2026-10-26', compare: true } },
      },
    ])
  })

  it('ranking → GET /admin/dashboard/rankings/{key} with limit 100 by default, the key escaped', async () => {
    const { client, calls } = fakeClient()
    await createDashboardApi(client).ranking('ga.landing-pages', {
      from: '2026-10-20',
      to: '2026-10-26',
    })
    expect(calls[0]).toEqual({
      path: '/admin/dashboard/rankings/ga.landing-pages',
      request: { params: { from: '2026-10-20', to: '2026-10-26', limit: 100 } },
    })
  })

  it('realtime and layout use their own paths; the layout is saved with PUT and a JSON body; a trailing slash on the base path is dropped', async () => {
    const { client, calls } = fakeClient()
    const api = createDashboardApi(client, { basePath: '/ops/dash/' })
    await api.realtime()
    await api.layout()
    await api.saveLayout({ hidden: ['cloudflare.pageviews'], order: ['tiles', 'chart'] })
    expect(calls).toEqual([
      { path: '/ops/dash/realtime', request: undefined },
      { path: '/ops/dash/layout', request: undefined },
      {
        path: '/ops/dash/layout',
        request: {
          method: 'PUT',
          json: { hidden: ['cloudflare.pageviews'], order: ['tiles', 'chart'] },
        },
      },
    ])
  })
})
