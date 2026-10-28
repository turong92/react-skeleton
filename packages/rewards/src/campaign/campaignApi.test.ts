import { describe, expect, it } from 'vitest'
import { recordingClient } from '../test/recordingClient'
import { createCampaignApi } from './campaignApi'

describe('createCampaignApi', () => {
  it('lists campaigns with GET /campaigns', async () => {
    const { client, calls } = recordingClient([])
    await createCampaignApi(client).listCampaigns()
    expect(calls).toEqual([{ kind: 'list', path: '/campaigns', request: undefined }])
  })

  it('checks in with POST /campaigns/{id}/attendance (id is encoded)', async () => {
    const { client, calls } = recordingClient({ alreadyChecked: false })
    await createCampaignApi(client).checkIn('a/b')
    expect(calls).toEqual([
      { kind: 'value', path: '/campaigns/a%2Fb/attendance', request: { method: 'POST' } },
    ])
  })

  it('reads a month with GET /campaigns/{id}/attendance?month=', async () => {
    const { client, calls } = recordingClient({ days: [] })
    await createCampaignApi(client).attendanceMonth('c1', '2026-10')
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/campaigns/c1/attendance',
        request: { params: { month: '2026-10' } },
      },
    ])
  })

  it('reads my referral with GET /referrals/me and claims with POST /referrals/claim {code}', async () => {
    const { client, calls } = recordingClient({ code: 'AB12CD34' })
    const api = createCampaignApi(client)
    await api.myReferral()
    await api.claimReferral('AB12CD34')
    expect(calls).toEqual([
      { kind: 'value', path: '/referrals/me', request: undefined },
      {
        kind: 'noContent',
        path: '/referrals/claim',
        request: { method: 'POST', json: { code: 'AB12CD34' } },
      },
    ])
  })

  it('paths are settings', async () => {
    const { client, calls } = recordingClient([])
    await createCampaignApi(client, {
      campaigns: '/events/',
      referrals: '/invites',
    }).listCampaigns()
    expect(calls[0].path).toBe('/events')
  })
})
