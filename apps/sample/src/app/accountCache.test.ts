import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('author-profile device memory — dropped in the same place as the cache', () => {
  const store = new Map<string, string>()
  const fake = {
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  afterEach(() => {
    vi.unstubAllGlobals()
    store.clear()
  })

  it('a different account arriving forgets the remembered profile; unrelated keys stay', () => {
    vi.stubGlobal('localStorage', fake)
    authSession.signIn(login('A'))
    store.set('skeleton.author-profile:A:general', 'prf_a')
    store.set('theme', 'dark')
    authSession.signIn(login('B'))
    expect([...store.keys()]).toEqual(['theme'])
  })

  it('the same account refreshing its token keeps the memory', () => {
    vi.stubGlobal('localStorage', fake)
    authSession.signIn(login('B'))
    store.set('skeleton.author-profile:B:general', 'prf_b')
    authSession.signIn({ ...login('B'), accessToken: 'rotated' })
    expect(store.get('skeleton.author-profile:B:general')).toBe('prf_b')
  })

  it('a sign-out forgets the remembered profile too (the button, another tab, a failed refresh all end here)', () => {
    vi.stubGlobal('localStorage', fake)
    authSession.signIn(login('C'))
    store.set('skeleton.author-profile:C:general', 'prf_c')
    store.set('theme', 'dark')
    void authSession.logout().catch(() => undefined) // 이 기기의 로그아웃은 동기로 끝난다(서버 폐기 알림은 기다리지 않는다)
    expect([...store.keys()]).toEqual(['theme'])
  })
})

describe('workspace device memory — dropped in the same place as the cache', () => {
  const session = new Map<string, string>()
  const local = new Map<string, string>()
  const fake = (store: Map<string, string>) => ({
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    session.clear()
    local.clear()
  })

  it('a different account arriving drops the previous person’s invitation token and last team; the first sign-in keeps the token', () => {
    vi.stubGlobal('sessionStorage', fake(session))
    vi.stubGlobal('localStorage', fake(local))
    authSession.signIn(login('A'))
    session.set('skeleton.workspace.invitation', 'tok')
    local.set('skeleton.workspace:last:A', 'acme')
    local.set('theme', 'dark')
    authSession.signIn({ ...login('A'), accessToken: 'rotated' })
    expect(session.get('skeleton.workspace.invitation')).toBe('tok') // 같은 계정의 갱신
    authSession.signIn(login('B'))
    expect(session.has('skeleton.workspace.invitation')).toBe(false)
    expect([...local.keys()]).toEqual(['theme'])
  })
})
