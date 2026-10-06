import { describe, expect, it } from 'vitest'
import { authSession } from '../auth/session'
import { queryClient } from './queryClient'

const login = (accountId: string) => ({
  accessToken: `token-${accountId}`,
  tokenType: 'Bearer',
  expiresAt: '2030-01-01T00:00:00Z',
  principal: { accountId, roles: [] },
  refreshToken: `r.${accountId}`,
})

describe('I2 — the server-state cache is dropped whenever the signed-in account goes away or changes', () => {
  it('a different account arriving in the same tab (magic link / social landing) clears the cache', () => {
    authSession.signIn(login('A'))
    queryClient.setQueryData(['notes'], [{ id: 1, title: "A's private note" }])
    authSession.signIn(login('B'))
    expect(queryClient.getQueryData(['notes'])).toBeUndefined()
  })

  it('the same account refreshing its token keeps the cache', () => {
    authSession.signIn(login('B'))
    queryClient.setQueryData(['notes'], ['kept'])
    authSession.signIn({ ...login('B'), accessToken: 'rotated' })
    expect(queryClient.getQueryData(['notes'])).toEqual(['kept'])
  })
})
