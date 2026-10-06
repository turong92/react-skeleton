import {
  ApiRequestError,
  createApiClient,
  ErrorCodes,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from '@skeleton/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRefreshStore } from './refreshStore'
import { createSessionRefresher, type LockManagerLike } from './sessionRefresher'
import { createTokenStore } from './tokenStore'
import type { AuthTokenResponse } from './types'

const principal = { accountId: 'acc_1', roles: ['USER'] }
const tokens = (n: number): AuthTokenResponse => ({
  accessToken: `access-${n}`,
  tokenType: 'Bearer',
  expiresAt: '2026-10-06T01:15:00Z',
  principal,
  refreshToken: `r1.${n}`,
  refreshExpiresAt: '2026-11-05T00:00:00Z',
  sessionId: 'ses_1',
})
const failure = (status: number, code: string, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't', data }, 't', 's', 'p')

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

/** access-N 만 통과시키는 서버 — 현재 허용 토큰은 `valid.current` */
function server(valid: { current: string }) {
  const seen: string[] = []
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const auth = String(config.headers.get('Authorization') ?? '')
    seen.push(`${config.url} ${auth}`)
    const good = auth === `Bearer ${valid.current}`
    return {
      status: good ? 200 : 401,
      statusText: '',
      headers: {},
      config,
      data: good
        ? { value: config.url, meta: { timestamp: 't' } }
        : { code: 'COMMON.UNAUTHORIZED', title: 'u', status: 401, timestamp: 't' },
    }
  }
  return { adapter, seen }
}

function setup(opts: { delivery?: 'body' | 'cookie'; locks?: LockManagerLike | false } = {}) {
  const valid = { current: 'access-2' } // 서버는 이미 access-2 만 받는다 — 클라이언트는 만료된 access-1 을 쥐고 있다
  const access = createTokenStore()
  const refresh = createRefreshStore()
  access.set('access-1')
  refresh.set({ refreshToken: 'r1.1', sessionId: 'ses_1' })
  const ended = vi.fn()
  const call = vi.fn<(refreshToken: string | null) => Promise<AuthTokenResponse>>(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
    return tokens(2)
  })
  const refresher = createSessionRefresher({
    tokens: access,
    refreshTokens: refresh,
    delivery: opts.delivery ?? 'body',
    refresh: call,
    onSessionEnded: ended,
    locks: opts.locks ?? false,
  })
  const srv = server(valid)
  const client = createApiClient({
    baseUrl: '/api',
    adapter: srv.adapter,
    getAuthHeaders: () => ({ Authorization: `Bearer ${access.get()}` }),
    recoverUnauthorized: refresher.recover,
  })
  return { access, refresh, ended, call, client, srv }
}

describe('session refresher', () => {
  it('five concurrent 401s trigger exactly one refresh, and every original request is retried once with the new token', async () => {
    const { client, call, srv, access } = setup()
    const all = Promise.all(['/a', '/b', '/c', '/d', '/e'].map((p) => client.value<string>(p)))
    await vi.advanceTimersByTimeAsync(60)
    await expect(all).resolves.toEqual(['/a', '/b', '/c', '/d', '/e'])
    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith('r1.1')
    expect(srv.seen.filter((s) => s.endsWith('access-1'))).toHaveLength(5)
    expect(srv.seen.filter((s) => s.endsWith('access-2'))).toHaveLength(5)
    expect(access.get()).toBe('access-2')
  })

  it('stores the rotated refresh token with the new access token (rotation-safe: the old one is never presented twice)', async () => {
    const { client, call, refresh } = setup()
    const first = client.value('/a')
    await vi.advanceTimersByTimeAsync(60)
    await first
    expect(refresh.get()).toMatchObject({ refreshToken: 'r1.2', sessionId: 'ses_1' })
    // a later 401 would present r1.2 — never r1.1 again
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('a request whose 401 arrives after the refresh finished does not refresh again (it just retries with the current token)', async () => {
    const { client, call, access } = setup()
    const first = client.value('/first')
    await vi.advanceTimersByTimeAsync(60)
    await first
    expect(access.get()).toBe('access-2')
    // a slow in-flight request that was sent with the OLD token fails only now: the store already holds access-2
    const recovered = await createLateRecover(access, call)
    expect(recovered).toBe(true)
    expect(call).toHaveBeenCalledTimes(1) // still only the first refresh
  })

  it('signs out (both stores) and reports "reuse-detected" on AUTH.REFRESH_REUSED', async () => {
    const { client, call, ended, access, refresh } = setup()
    call.mockRejectedValueOnce(failure(401, ErrorCodes.AUTH_REFRESH_REUSED))
    await expect(client.value('/a')).rejects.toMatchObject({ apiError: { status: 401 } })
    expect(ended).toHaveBeenCalledWith('reuse-detected')
    expect(access.get()).toBeNull()
    expect(refresh.get()).toBeNull()
  })

  it('signs out with "expired" on AUTH.REFRESH_INVALID and "suspended" on AUTH.ACCOUNT_SUSPENDED', async () => {
    const a = setup()
    a.call.mockRejectedValueOnce(failure(401, ErrorCodes.AUTH_REFRESH_INVALID))
    await expect(a.client.value('/a')).rejects.toBeDefined()
    expect(a.ended).toHaveBeenCalledWith('expired')
    const b = setup()
    b.call.mockRejectedValueOnce(failure(403, ErrorCodes.AUTH_ACCOUNT_SUSPENDED))
    await expect(b.client.value('/a')).rejects.toBeDefined()
    expect(b.ended).toHaveBeenCalledWith('suspended')
  })

  it('a network failure during refresh keeps the session and surfaces that error, not a 401', async () => {
    const { client, call, ended, access, refresh } = setup()
    call.mockRejectedValueOnce(failure(0, 'CLIENT.NETWORK_ERROR'))
    await expect(client.value('/a')).rejects.toMatchObject({ apiError: { status: 0 } })
    expect(ended).not.toHaveBeenCalled()
    expect(access.get()).toBe('access-1')
    expect(refresh.get()?.refreshToken).toBe('r1.1')
    // and the next 401 may try again
    const retry = client.value('/a')
    await vi.advanceTimersByTimeAsync(60)
    await expect(retry).resolves.toBe('/a')
  })

  it('without any refresh credential the 401 simply ends the session', async () => {
    const { client, refresh, ended, call } = setup()
    refresh.clear()
    await expect(client.value('/a')).rejects.toBeDefined()
    expect(call).not.toHaveBeenCalled()
    expect(ended).toHaveBeenCalledWith('unauthenticated')
  })

  it('cookie mode refreshes without a body token when the session marker exists', async () => {
    const { client, call, refresh } = setup({ delivery: 'cookie' })
    refresh.set({ refreshToken: null, sessionId: 'ses_1' })
    const first = client.value('/a')
    await vi.advanceTimersByTimeAsync(60)
    await first
    expect(call).toHaveBeenCalledWith(null)
    // the rotated cookie is invisible to JS: only the marker stays
    expect(refresh.get()).toEqual({
      refreshToken: null,
      refreshExpiresAt: '2026-11-05T00:00:00Z',
      sessionId: 'ses_1',
    })
  })

  it('two tabs: the loser of the lock sees the winner’s rotation and does not call the server', async () => {
    // one shared lock manager + one shared "localStorage" for both tabs
    let tail: Promise<unknown> = Promise.resolve()
    const locks: LockManagerLike = {
      request: <T>(_name: string, run: () => Promise<T>) => {
        const next = tail.then(run, run)
        tail = next.catch(() => undefined)
        return next
      },
    }
    const data = new Map<string, string>()
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
    const mk = () => {
      const access = createTokenStore({ storage })
      const refresh = createRefreshStore({ storage })
      const call = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return tokens(2)
      })
      const refresher = createSessionRefresher({
        tokens: access,
        refreshTokens: refresh,
        delivery: 'body',
        refresh: call,
        locks,
      })
      return { access, refresh, call, refresher }
    }
    const tabA = mk()
    const tabB = mk() // reads the same storage; its in-memory copy goes stale after A refreshes
    tabA.access.set('access-1')
    tabA.refresh.set({ refreshToken: 'r1.1', sessionId: 'ses_1' })
    tabB.access.reload()
    const failed = 'Bearer access-1'
    const pa = tabA.refresher.refresh(failed)
    const pb = tabB.refresher.refresh(failed)
    await vi.advanceTimersByTimeAsync(120)
    await expect(Promise.all([pa, pb])).resolves.toEqual([true, true])
    expect(tabA.call).toHaveBeenCalledTimes(1)
    expect(tabB.call).not.toHaveBeenCalled()
    expect(tabB.access.get()).toBe('access-2')
  })

  it('is SSR-safe: building one without window or navigator does not throw', () => {
    expect(() =>
      createSessionRefresher({
        tokens: createTokenStore(),
        refreshTokens: createRefreshStore(),
        delivery: 'body',
        refresh: async () => tokens(1),
      }),
    ).not.toThrow()
  })
})

/** 같은 저장소를 쓰는 갱신기에 「낡은 토큰으로 보낸 요청의 401」이 늦게 도착한 상황 */
async function createLateRecover(
  access: ReturnType<typeof createTokenStore>,
  call: (refreshToken: string | null) => Promise<AuthTokenResponse>,
) {
  const refresh = createRefreshStore()
  refresh.set({ refreshToken: 'r1.2', sessionId: 'ses_1' })
  const refresher = createSessionRefresher({
    tokens: access,
    refreshTokens: refresh,
    delivery: 'body',
    refresh: call,
    locks: false,
  })
  return refresher.recover({ failedAuthorization: 'Bearer access-1' } as never)
}
