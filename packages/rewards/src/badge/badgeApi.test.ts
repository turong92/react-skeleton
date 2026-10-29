import { describe, expect, it } from 'vitest'
import { recordingClient } from '../test/recordingClient'
import { createBadgeApi } from './badgeApi'

describe('createBadgeApi', () => {
  it('reads my badges with GET /badges/me', async () => {
    const { client, calls } = recordingClient({ earned: [], locked: [] })
    await createBadgeApi(client).myBadges()
    expect(calls).toEqual([{ kind: 'value', path: '/badges/me', request: undefined }])
  })

  it('flips the profile switch with PATCH /badges/me/{awardId} {visible}', async () => {
    const { client, calls } = recordingClient({ awardId: 'a 1', visible: false })
    await createBadgeApi(client).setBadgeVisible('a 1', false)
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/badges/me/a%201',
        request: { method: 'PATCH', json: { visible: false } },
      },
    ])
  })

  it('reads a profile with GET /badges/accounts/{id} and unwraps {badges}', async () => {
    const badge = { code: 'early', name: 'Early', description: 'd', imageUrl: null }
    const { client, calls } = recordingClient({ badges: [badge] })
    const result = await createBadgeApi(client).profileBadges('acc/1')
    expect(result).toEqual([badge])
    expect(calls).toEqual([
      // skipAuth 를 주면 공개 경로 401 이 로그인한 사람을 로그아웃시킨다(앱의 401 처리가 토큰을 지운다)
      { kind: 'value', path: '/badges/accounts/acc%2F1', request: undefined },
    ])
  })

  it('takes the base path from the app', async () => {
    const { client, calls } = recordingClient({ earned: [], locked: [] })
    await createBadgeApi(client, { badges: '/x/badges/' }).myBadges()
    expect(calls[0].path).toBe('/x/badges/me')
  })
})
