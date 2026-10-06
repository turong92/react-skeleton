import {
  createApiClient,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAuthApi } from './authApi'
import { createAuthHeadersProvider } from './apiClientHooks'
import { createRefreshStore } from './refreshStore'
import { createAuthSession } from './session'
import { createSessionRefresher } from './sessionRefresher'
import { createTokenStore, type TokenStorage } from './tokenStore'

/*
 * 쿠키 모드(`skeleton.auth-session.delivery=cookie`)의 클라이언트 쪽 계약을 통합해서 확인한다 — 앱이 `VITE_AUTH_REFRESH_DELIVERY=cookie` 한 줄로 켜는 길이
 * 실제로 이어져 있는가: 리프레시 토큰이 JS 에 닿지 않고(저장소에 없다) · 갱신 · 로그아웃이 CSRF 헤더 + 자격 증명 포함으로 나가며 · 세션이 이어진다.
 * 가짜 백엔드는 문서(account-http-contract.md 1절)의 서버 규칙을 그대로 따른다: 쿠키 `skeleton_refresh` · 본문의 리프레시 토큰은 무시 ·
 * `X-Requested-With: fetch` 가 없으면 403 `AUTH.CSRF_HEADER_REQUIRED`.
 */
const principal = { accountId: 'acc_1', roles: ['USER'] }

function cookieBackend() {
  let cookie: string | null = null
  let access = 0
  const log: Array<{ path: string; csrf: boolean; credentials: boolean; body: unknown }> = []
  const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown) => ({
    status,
    statusText: '',
    headers: {},
    config,
    data,
  })
  const tokens = () => {
    access += 1
    return {
      accessToken: `access-${access}`,
      tokenType: 'Bearer',
      expiresAt: '2026-10-06T01:15:00Z',
      principal,
      refreshExpiresAt: '2026-11-05T00:00:00Z',
      sessionId: 'ses_1',
      // 쿠키 모드: refreshToken 은 본문에 없다
    }
  }
  const adapter: AxiosAdapter = async (config) => {
    const path = String(config.url)
    const csrf = String(config.headers.get('X-Requested-With') ?? '') === 'fetch'
    const credentials = config.withCredentials === true
    const body = config.data ? JSON.parse(String(config.data)) : undefined
    log.push({ path, csrf, credentials, body })
    if (path === '/auth/login') {
      cookie = 'skeleton_refresh=r1.opaque'
      return respond(config, 200, { value: tokens(), meta: { timestamp: 't' } })
    }
    if (path === '/auth/refresh' || path === '/auth/logout') {
      if (!csrf)
        return respond(config, 403, {
          code: 'AUTH.CSRF_HEADER_REQUIRED',
          title: 'csrf',
          status: 403,
          timestamp: 't',
        })
      if (path === '/auth/logout') {
        cookie = null
        return respond(config, 204, undefined)
      }
      if (!credentials || !cookie)
        return respond(config, 401, {
          code: 'AUTH.REFRESH_INVALID',
          title: 'no cookie',
          status: 401,
          timestamp: 't',
        })
      return respond(config, 200, { value: tokens(), meta: { timestamp: 't' } })
    }
    // 보호된 호출: 가장 최근 액세스 토큰만 받는다
    const good = String(config.headers.get('Authorization') ?? '') === `Bearer access-${access}`
    return good
      ? respond(config, 200, { value: 'secret', meta: { timestamp: 't' } })
      : respond(config, 401, {
          code: 'COMMON.UNAUTHORIZED',
          title: 'u',
          status: 401,
          timestamp: 't',
        })
  }
  return { adapter, log, hasCookie: () => cookie !== null }
}

function memoryStorage() {
  const map = new Map<string, string>()
  const storage: TokenStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
  return { map, storage }
}

describe('cookie delivery (VITE_AUTH_REFRESH_DELIVERY=cookie ↔ skeleton.auth-session.delivery=cookie)', () => {
  function assemble(delivery: 'body' | 'cookie' = 'cookie') {
    const backend = cookieBackend()
    const mem = memoryStorage()
    const access = createTokenStore({ storage: mem.storage })
    const refreshTokens = createRefreshStore({ storage: mem.storage })
    const holder: { api?: ReturnType<typeof createAuthApi> } = {}
    const refresher = createSessionRefresher({
      tokens: access,
      refreshTokens,
      delivery,
      refresh: (token) => holder.api!.refresh(token),
      locks: false,
    })
    const client = createApiClient({
      baseUrl: '/api/v1',
      adapter: backend.adapter,
      withCredentials: delivery === 'cookie', // 앱이 `refreshDelivery === 'cookie'` 로 켠다
      getAuthHeaders: createAuthHeadersProvider(access),
      recoverUnauthorized: refresher.recover,
    })
    holder.api = createAuthApi(client, { delivery })
    const session = createAuthSession({
      api: holder.api,
      store: access,
      refreshStore: refreshTokens,
      delivery,
    })
    return { backend, mem, client, session, access, refreshTokens }
  }

  it('the refresh token never reaches JavaScript: the browser storage holds only a signed-in marker', async () => {
    const { session, mem } = assemble()
    await session.login({ email: 'a@b.c', password: 'pw' })
    const stored = [...mem.map.values()].join('\n')
    expect(stored).not.toContain('r1.opaque')
    expect(stored).not.toMatch(/"refreshToken":"[^"]/)
    expect(stored).toContain('ses_1') // 「로그인해 있다」 표식
  })

  it('an expired access token is recovered by a refresh that carries the CSRF header and credentials, and no body token', async () => {
    const { session, client, backend, access } = assemble()
    await session.login({ email: 'a@b.c', password: 'pw' })
    access.set('expired') // 액세스 토큰이 낡았다
    expect(await client.value('/secret')).toBe('secret')
    const refresh = backend.log.find((entry) => entry.path === '/auth/refresh')
    expect(refresh).toMatchObject({ csrf: true, credentials: true })
    expect(refresh?.body ?? {}).toEqual({}) // 쿠키 모드: 본문의 refreshToken 은 없다
    expect(access.get()).toBe('access-2')
  })

  it('logout sends the CSRF header too and clears the marker; the cookie is gone server-side', async () => {
    const { session, backend, refreshTokens } = assemble()
    await session.login({ email: 'a@b.c', password: 'pw' })
    await session.logout()
    const logout = backend.log.find((entry) => entry.path === '/auth/logout')
    expect(logout).toMatchObject({ csrf: true, credentials: true })
    expect(refreshTokens.get()).toBeNull()
    expect(backend.hasCookie()).toBe(false)
  })

  it('the pairing matters: an app left on body against a cookie backend gets the CSRF refusal at the first refresh — one attempt, no loop', async () => {
    const { session, client, backend, access } = assemble('body')
    await session.login({ email: 'a@b.c', password: 'pw' }) // 쿠키 모드 백엔드는 본문에 토큰을 주지 않는다 → 저장할 리프레시 토큰이 없다
    access.set('expired')
    await expect(client.value('/secret')).rejects.toBeDefined()
    expect(
      backend.log.filter((entry) => entry.path === '/auth/refresh').length,
    ).toBeLessThanOrEqual(1)
  })
})
