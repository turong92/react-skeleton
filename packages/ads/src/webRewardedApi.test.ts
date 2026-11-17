import { describe, expect, it } from 'vitest'
import { createWebRewardedApi } from './webRewardedApi'

function recordingClient() {
  const calls: Array<{ path: string; options: unknown }> = []
  const client = {
    value: (path: string, options?: unknown) => {
      calls.push({ path, options })
      return Promise.resolve({} as never)
    },
  }
  return { client, calls }
}

describe('createWebRewardedApi', () => {
  it('opens a session with POST {purpose} and asks for the grant with a body-less POST', async () => {
    const { client, calls } = recordingClient()
    const api = createWebRewardedApi(client)
    await api.openSession('unlock')
    await api.grant('wrs_1')
    expect(calls).toEqual([
      {
        path: '/ads/web-rewarded/sessions',
        options: { method: 'POST', json: { purpose: 'unlock' } },
      },
      { path: '/ads/web-rewarded/sessions/wrs_1/grant', options: { method: 'POST' } },
    ])
  })

  it('uses basePath when the app moved the module endpoints', async () => {
    const { client, calls } = recordingClient()
    const api = createWebRewardedApi(client, { basePath: '/x/ads/' })
    await api.openSession('p')
    await api.grant('wrs_2')
    expect(calls.map((c) => c.path)).toEqual(['/x/ads/sessions', '/x/ads/sessions/wrs_2/grant'])
  })
})
