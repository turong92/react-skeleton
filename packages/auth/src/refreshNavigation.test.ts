import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { createRefreshStore } from './refreshStore'
import { createSessionRefresher } from './sessionRefresher'
import { createTokenStore, type TokenStorage } from './tokenStore'
import type { AuthTokenResponse } from './types'

/*
 * 갱신 도중 페이지가 이동했을 때(응답을 잃었을 때)의 두 가지 서버 설정:
 *   reuse-grace 10s(샘플 · 스타터 백엔드): 직전 토큰을 유예 안에 다시 내밀면 같은 후속 토큰을 돌려준다(멱등 회전) → 세션이 이어진다
 *   모듈 기본 0s: 직전 토큰 재사용 = 탈취로 보고 세션을 닫는다(401 AUTH.REFRESH_REUSED) → 클라이언트는 한 번 로그아웃하고 멈춘다(루프 없음)
 */

const principal = { accountId: 'acc_1', roles: ['USER'] }
const response = (n: number): AuthTokenResponse => ({
  accessToken: `access-${n}`,
  tokenType: 'Bearer',
  expiresAt: '2026-10-06T01:15:00Z',
  principal,
  refreshToken: `r1.${n}`,
  refreshExpiresAt: '2026-11-05T00:00:00Z',
  sessionId: 'ses_1',
})
const reused = () =>
  new ApiRequestError(
    {
      code: ErrorCodes.AUTH_REFRESH_REUSED,
      title: 'reused',
      status: 401,
      timestamp: 't',
    },
    't',
    's',
    'p',
  )

/** 회전하는 가짜 서버 — `graceMs` 0 이면 모듈 기본, 양수면 직전 토큰을 그 안에 다시 받으면 같은 후속을 돌려준다 */
function rotatingServer(graceMs: number, clock: { now: number }) {
  let n = 1
  let current = 'r1.1'
  let previous: { token: string; successor: AuthTokenResponse; at: number } | null = null
  let revoked = false
  const requests: string[] = []
  return {
    requests,
    isRevoked: () => revoked,
    refresh(token: string | null): AuthTokenResponse {
      requests.push(String(token))
      if (revoked) throw reused()
      if (token === current) {
        n += 1
        const successor = response(n)
        previous = { token: current, successor, at: clock.now }
        current = successor.refreshToken as string
        return successor
      }
      if (previous && token === previous.token && clock.now - previous.at <= graceMs)
        return previous.successor // 멱등 — 같은 후속 토큰
      revoked = true
      throw reused()
    },
  }
}

function sharedStorage() {
  const map = new Map<string, string>()
  const storage: TokenStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
  return storage
}

/** 한 「페이지 로드」 — 같은 저장소 위에 새 저장소 객체 · 새 갱신기(탭 이동 = 메모리가 사라지고 저장소만 남는다) */
function pageLoad(
  storage: TokenStorage,
  call: (token: string | null) => Promise<AuthTokenResponse>,
) {
  const access = createTokenStore({ storage })
  const refreshTokens = createRefreshStore({ storage })
  const ended = vi.fn()
  const refresher = createSessionRefresher({
    tokens: access,
    refreshTokens,
    delivery: 'body',
    refresh: call,
    onSessionEnded: ended,
    locks: false,
  })
  return { access, refreshTokens, ended, refresher }
}

describe('navigation during a refresh (the response never reaches the page that asked)', () => {
  const seed = (storage: TokenStorage) => {
    createTokenStore({ storage }).set('access-expired')
    createRefreshStore({ storage }).set({ refreshToken: 'r1.1', sessionId: 'ses_1' })
  }

  it('with the sample backend grace (10s): the next page presents the previous token and gets the SAME successor — the session continues', async () => {
    const clock = { now: 0 }
    const server = rotatingServer(10_000, clock)
    const storage = sharedStorage()
    seed(storage)

    // 첫 페이지: 서버는 회전했지만 응답이 닿기 전에 페이지가 떠났다(fetch 가 TypeError 로 끝난다)
    let lostSuccessor: AuthTokenResponse | undefined
    const first = pageLoad(storage, async (token) => {
      lostSuccessor = server.refresh(token)
      throw new TypeError('Load failed')
    })
    await expect(first.refresher.refresh('Bearer access-expired')).rejects.toThrow('Load failed')
    // 이동 중에 낸 실패는 세션을 건드리지 않는다 — 저장소에는 아직 옛 토큰이 있다
    expect(first.ended).not.toHaveBeenCalled()
    expect(createRefreshStore({ storage }).get()?.refreshToken).toBe('r1.1')

    // 다음 페이지(5초 뒤): 같은 저장소 · 옛 토큰으로 갱신
    clock.now = 5_000
    const second = pageLoad(storage, async (token) => server.refresh(token))
    expect(await second.refresher.refresh('Bearer access-expired')).toBe(true)
    expect(second.ended).not.toHaveBeenCalled()
    expect(second.access.get()).toBe(lostSuccessor?.accessToken)
    expect(second.refreshTokens.get()?.refreshToken).toBe(lostSuccessor?.refreshToken)
    expect(server.isRevoked()).toBe(false)
    // 회전은 한 번만 일어났다(같은 후속)
    expect(server.requests).toEqual(['r1.1', 'r1.1'])
  })

  it('with the module default (0s): the replay is read as theft — one clean sign-out with the reason, stores emptied, no retry loop', async () => {
    const clock = { now: 0 }
    const server = rotatingServer(0, clock)
    const storage = sharedStorage()
    seed(storage)

    const first = pageLoad(storage, async (token) => {
      server.refresh(token)
      throw new TypeError('Load failed')
    })
    await expect(first.refresher.refresh('Bearer access-expired')).rejects.toThrow()

    clock.now = 1
    const second = pageLoad(storage, async (token) => server.refresh(token))
    expect(await second.refresher.refresh('Bearer access-expired')).toBe(false)
    expect(second.ended).toHaveBeenCalledTimes(1)
    expect(second.ended).toHaveBeenCalledWith('reuse-detected')
    expect(createTokenStore({ storage }).get()).toBeNull()
    expect(createRefreshStore({ storage }).get()).toBeNull()
    // 다시 시도해도 서버를 또 두드리지 않는다(자격이 없다)
    expect(await second.refresher.refresh()).toBe(false)
    expect(server.requests).toHaveLength(2)
  })

  it('after the grace has passed the replay is theft even with grace on (the window is a few seconds, not a promise)', async () => {
    const clock = { now: 0 }
    const server = rotatingServer(10_000, clock)
    const storage = sharedStorage()
    seed(storage)
    const first = pageLoad(storage, async (token) => {
      server.refresh(token)
      throw new TypeError('Load failed')
    })
    await expect(first.refresher.refresh('Bearer access-expired')).rejects.toThrow()
    clock.now = 11_000
    const second = pageLoad(storage, async (token) => server.refresh(token))
    expect(await second.refresher.refresh('Bearer access-expired')).toBe(false)
    expect(second.ended).toHaveBeenCalledWith('reuse-detected')
  })
})
