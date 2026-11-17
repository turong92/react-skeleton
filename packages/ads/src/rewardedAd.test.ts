import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeGoogletag } from './fakeGoogletag'
import type { FakeRewardedOutcome } from './fakeGoogletag'
import type { GoogletagLike } from './googletag'
import { createRewardedAd } from './rewardedAd'
import type { RewardedAdOptions } from './rewardedAd'
import type { WebRewardedApi, WebRewardedGrant } from './types'

/* 진짜 GPT 는 싣지 않는다 — 가짜 googletag(미디어 없음, 소리 없음)에 호출 횟수를 세는 막만 씌운다 */

const GRANT: WebRewardedGrant = {
  sessionId: 'wrs_1',
  purpose: 'unlock',
  grantedAt: '2026-11-18T03:00:31Z',
  reward: { type: 'point', ref: 'pt_1' },
  token: null,
  tokenExpiresAt: null,
}

function setup(
  outcome: FakeRewardedOutcome = 'granted',
  extra: Partial<RewardedAdOptions> = {},
  openSession: WebRewardedApi['openSession'] = () =>
    Promise.resolve({ sessionId: 'wrs_1', purpose: 'unlock', expiresAt: '2026-11-18T03:15:00Z' }),
) {
  const fake = createFakeGoogletag({ outcome, watchMs: 8000 })
  const count = { define: 0, destroy: 0, visible: 0 }
  const listeners: Record<string, (event: { slot: unknown }) => void> = {}
  let readyEvent: { slot: unknown } | undefined
  const loadGoogletag = async (): Promise<GoogletagLike> => {
    const g = await fake.loader()
    const define = g.defineOutOfPageSlot.bind(g)
    g.defineOutOfPageSlot = (path, format) => {
      count.define++
      return define(path, format)
    }
    const destroy = g.destroySlots.bind(g)
    g.destroySlots = (slots) => {
      count.destroy++
      return destroy(slots)
    }
    const pubads = g.pubads()
    const add = pubads.addEventListener.bind(pubads)
    pubads.addEventListener = (type, listener) => {
      listeners[type] = listener as never
      return add(type, (event) => {
        if (type === 'rewardedSlotReady') {
          const ready = event as { slot: unknown; makeRewardedVisible(): boolean }
          readyEvent = ready
          const visible = ready.makeRewardedVisible.bind(ready)
          ready.makeRewardedVisible = () => {
            count.visible++
            return visible()
          }
        }
        ;(listener as (e: unknown) => void)(event)
      })
    }
    return g
  }
  const api = {
    openSession: vi.fn(openSession),
    grant: vi.fn(() => Promise.resolve(GRANT)),
  }
  const ad = createRewardedAd({
    api,
    adUnitPath: '/1234/rewarded',
    purpose: 'unlock',
    loadGoogletag,
    isUserActive: () => true,
    ...extra,
  })
  return { ad, api, count, listeners, ready: () => readyEvent }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

describe('createRewardedAd', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('consent -> play -> granted: nothing plays before watch(), then one grant request', async () => {
    const { ad, api, count } = setup()
    ad.start()
    await flush()
    expect(ad.getState().status).toBe('ready')
    expect(count.visible).toBe(0)
    ad.watch()
    expect(ad.getState().status).toBe('playing')
    await vi.advanceTimersByTimeAsync(8000)
    expect(ad.getState()).toEqual({ status: 'rewarded', grant: GRANT })
    expect(api.openSession).toHaveBeenCalledWith('unlock')
    expect(api.grant).toHaveBeenCalledExactlyOnceWith('wrs_1')
    expect(count.destroy).toBe(1)
  })

  it('watchWithoutUserActivationDoesNotShow', async () => {
    const { ad, count } = setup('granted', { isUserActive: () => false })
    ad.start()
    await flush()
    ad.watch()
    expect(ad.getState().status).toBe('ready')
    expect(count.visible).toBe(0)
  })

  it('grantedTwiceGrantsOnce', async () => {
    const { ad, api, listeners, ready } = setup()
    ad.start()
    await flush()
    ad.watch()
    const slot = ready()!.slot
    listeners.rewardedSlotGranted({ slot })
    listeners.rewardedSlotGranted({ slot })
    await vi.advanceTimersByTimeAsync(8000)
    expect(api.grant).toHaveBeenCalledTimes(1)
    expect(ad.getState()).toEqual({ status: 'rewarded', grant: GRANT })
  })

  it('closedWithoutGrantIsForfeited', async () => {
    const { ad, api, count } = setup('closed')
    ad.start()
    await flush()
    ad.watch()
    await vi.advanceTimersByTimeAsync(8000)
    expect(ad.getState().status).toBe('forfeited')
    expect(api.grant).not.toHaveBeenCalled()
    expect(count.destroy).toBe(1)
  })

  it.each(['granted', 'closed'] as const)('noAutomaticRestartAfterEnd (%s)', async (outcome) => {
    const { ad, api, count } = setup(outcome)
    ad.start()
    await flush()
    ad.watch()
    await vi.advanceTimersByTimeAsync(8000)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(count.define).toBe(1)
    expect(api.openSession).toHaveBeenCalledTimes(1)
  })

  it('dailyLimitAtOpenDefinesNoSlot', async () => {
    const limit = new ApiRequestError(
      {
        code: ErrorCodes.ADS_WEB_REWARDED_DAILY_LIMIT,
        title: 'limit',
        status: 409,
        timestamp: '2026-11-18T03:00:00Z',
      },
      't',
      's',
      'p',
    )
    const { ad, count } = setup('granted', {}, () => Promise.reject(limit))
    ad.start()
    await flush()
    expect(ad.getState().status).toBe('limited')
    expect(count.define).toBe(0)
  })

  it('dailyLimitAtGrantIsLimitedNotFailed', async () => {
    const limit = new ApiRequestError(
      {
        code: ErrorCodes.ADS_WEB_REWARDED_DAILY_LIMIT,
        title: 'limit',
        status: 409,
        timestamp: '2026-11-18T03:00:00Z',
      },
      't',
      's',
      'p',
    )
    const api = {
      openSession: () =>
        Promise.resolve({
          sessionId: 'wrs_1',
          purpose: 'unlock',
          expiresAt: '2026-11-18T03:15:00Z',
        }),
      grant: vi.fn(() => Promise.reject(limit)),
    }
    const { ad } = setup('granted', { api })
    ad.start()
    await flush()
    ad.watch()
    await vi.advanceTimersByTimeAsync(8000)
    expect(api.grant).toHaveBeenCalledTimes(1)
    expect(ad.getState().status).toBe('limited')
  })

  it('noFillIsUnavailable', async () => {
    const { ad, count } = setup('no-fill')
    ad.start()
    await flush()
    expect(ad.getState().status).toBe('unavailable')
    expect(count.destroy).toBe(1)
  })

  it('a load error is failed and a second start() retries from the end state', async () => {
    const { ad, api } = setup('load-error')
    ad.start()
    await flush()
    expect(ad.getState().status).toBe('failed')
    ad.start()
    await flush()
    expect(api.openSession).toHaveBeenCalledTimes(2)
  })

  it('cancel() on the consent step destroys the slot and goes back to idle without a grant request', async () => {
    const { ad, api, count } = setup()
    ad.start()
    await flush()
    ad.cancel()
    expect(ad.getState().status).toBe('idle')
    expect(count.destroy).toBe(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.grant).not.toHaveBeenCalled()
  })

  it('destroy() stops everything: later events change nothing', async () => {
    const { ad, api } = setup()
    ad.start()
    await flush()
    ad.watch()
    const listener = vi.fn()
    ad.subscribe(listener)
    ad.destroy()
    await vi.advanceTimersByTimeAsync(8000)
    expect(api.grant).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })
})
