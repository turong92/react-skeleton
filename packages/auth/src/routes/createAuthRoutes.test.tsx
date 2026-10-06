import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../AuthProvider'
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
  methods: async () => {
    throw new Error('unused')
  },
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
        '/confirm-reauth',
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

  it('the re-authentication landing is always there (a mail link must never 404), outside the guard', () => {
    expect(paths({ ...base, methods: { password: true } })).toContain('/confirm-reauth')
    const routes = createAuthRoutes(base)
    expect(routes.find((r) => r.path === '/confirm-reauth')).toBeDefined()
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

describe('createAuthRoutes with discovery (the backend tells which methods exist)', () => {
  const discovery = { social: { session } }

  it('registers every landing a discovered method might need, since the methods are not known yet at route creation', () => {
    expect(paths({ ...base, discovery })).toEqual(
      expect.arrayContaining(['/magic-link', '/auth/callback', '/account/link-callback']),
    )
  })

  it('an explicit methods config wins over discovery (the env override): no discovery, routes follow the config', () => {
    const list = paths({ ...base, discovery, methods: { password: true } })
    expect(list).not.toContain('/magic-link')
    expect(list).not.toContain('/auth/callback')
  })

  const renderRoute = (options: Parameters<typeof createAuthRoutes>[0], path: string) => {
    const route = createAuthRoutes(options).find((r) => r.path === path)
    return renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider session={session}>{route?.element}</AuthProvider>
      </MemoryRouter>,
    )
  }

  it('no flash of wrong methods: before the answer arrives the sign-in page shows a loading state, not the env defaults', () => {
    const out = renderRoute({ ...base, discovery }, '/login')
    expect(out).toContain('Checking how you can sign in')
    expect(out).not.toContain('type="password"')
    expect(out).not.toContain('Email me a sign-in link')
  })

  it('with an explicit methods config the sign-in page renders at once', () => {
    const out = renderRoute({ ...base, methods: { password: true } }, '/login')
    expect(out).toContain('type="password"')
    expect(out).not.toContain('Checking how you can sign in')
  })

  it('the sign-up page also waits for the answer (it may be closed)', () => {
    const out = renderRoute({ ...base, discovery }, '/sign-up')
    expect(out).toContain('Checking how you can sign in')
    expect(out).not.toContain('type="password"')
  })
})
