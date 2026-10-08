import { describe, expect, it } from 'vitest'
import { createFakeAuthApi } from './fakeAuthApi'

describe('fake auth api: a social sign-in that gives no address', () => {
  it('signs in with a principal that has no email (Kakao · Naver · X · LINE) — the app then sees me.emailRequired', async () => {
    const api = createFakeAuthApi({ socialWithoutAddress: true })
    const session = await api.socialLogin('line', 'code')
    expect(session.principal.email ?? null).toBeNull()
    expect((await api.me()).email ?? null).toBeNull()
  })

  it('by default the demo account has an address', async () => {
    const session = await createFakeAuthApi().socialLogin('line', 'code')
    expect(session.principal.email).toBe('demo@example.com')
  })
})
