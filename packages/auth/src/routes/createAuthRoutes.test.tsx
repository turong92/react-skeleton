import { describe, expect, it } from 'vitest'
import type { AccountApi } from '../account/accountApi'
import type { AuthApi } from '../authApi'
import { createAuthSession } from '../session'
import type { SocialLoginFlow } from '../social'
import { createTokenStore } from '../tokenStore'
import { createAuthRoutes, DEFAULT_AUTH_PATHS } from './createAuthRoutes'

const unused = async () => {
  throw new Error('unused')
}
const api = {
  login: unused,
  socialLogin: unused,
  me: unused,
  refresh: unused,
  logout: unused,
  magicLinkRequest: unused,
  magicLinkRedeem: unused,
} as AuthApi
const session = createAuthSession({ api, store: createTokenStore() })
const accountApi = {} as AccountApi
const base = { session, authApi: api, accountApi, locales: [{ value: 'en', label: 'English' }] }
const paths = (options: Parameters<typeof createAuthRoutes>[0]) =>
  createAuthRoutes(options)
    .flatMap((r) => [r.path, ...(r.children?.map((c) => c.path) ?? [])])
    .filter(Boolean)

describe('createAuthRoutes', () => {
  it('ships the whole lifecycle when every method is on', () => {
    expect(
      paths({ ...base, methods: { magicLink: true }, socialFlow: {} as SocialLoginFlow }),
    ).toEqual(
      expect.arrayContaining([
        '/login',
        '/sign-up',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
        '/magic-link',
        '/auth/callback',
        '/confirm-email-change',
        '/account',
        '/confirm-delete',
      ]),
    )
  })

  it('every piece is switchable: no sign-up, no password reset, no magic link', () => {
    const list = paths({
      ...base,
      signUp: false,
      forgotPassword: false,
      methods: { password: true, magicLink: false },
    })
    expect(list).not.toContain('/sign-up')
    expect(list).not.toContain('/forgot-password')
    expect(list).not.toContain('/reset-password')
    expect(list).not.toContain('/magic-link')
    expect(list).toContain('/login')
  })

  it('the magic link landing exists exactly when that method is enabled', () => {
    expect(paths({ ...base, methods: { magicLink: true } })).toContain('/magic-link')
    expect(paths({ ...base, methods: { password: true } })).not.toContain('/magic-link')
  })

  it('social callback exists only with a social flow', () => {
    expect(paths(base)).not.toContain('/auth/callback')
  })

  it('paths are configurable', () => {
    expect(paths({ ...base, paths: { signIn: '/sign-in' } })).toContain('/sign-in')
    expect(DEFAULT_AUTH_PATHS.signIn).toBe('/login')
  })

  it('each route carries the app handle (SEO noindex belongs to the app)', () => {
    const routes = createAuthRoutes({ ...base, handle: (page) => ({ page }) })
    const login = routes.find((r) => r.path === '/login')
    expect(login?.handle).toEqual({ page: 'signIn' })
  })

  it('the account page sits behind RequireAuth', () => {
    const routes = createAuthRoutes(base)
    const guard = routes.find((r) => r.children?.some((c) => c.path === '/account'))
    expect(guard).toBeDefined()
  })

  it('apis can come from a hook instead (server-rendered apps build them per request)', () => {
    const routes = createAuthRoutes({
      session,
      useApis: () => ({ authApi: api, accountApi }),
      locales: [],
    } as never)
    expect(routes.some((r) => r.path === '/login')).toBe(true)
  })

  it('throws a clear error when neither apis nor useApis are given', () => {
    expect(() => createAuthRoutes({ session } as never)).toThrow(/authApi/)
  })

  it('the guard around the account pages can be replaced (SSR apps use a hydration-safe guard)', () => {
    const Guard = () => null
    const routes = createAuthRoutes({ ...base, guard: <Guard /> })
    const guarded = routes.find((r) => r.children?.some((c) => c.path === '/account'))
    expect((guarded?.element as { type: unknown }).type).toBe(Guard)
  })
})
