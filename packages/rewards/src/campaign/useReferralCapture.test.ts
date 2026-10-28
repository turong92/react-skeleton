import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import {
  claimPendingReferral,
  createReferralCapture,
  type ReferralStorage,
} from './useReferralCapture'

function memoryStorage(): ReferralStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

const DAY = 24 * 60 * 60 * 1000
const rejected = (status: number, code: string) =>
  new ApiRequestError({ code, title: 'x', status } as never, 't', 's', 'p')

describe('createReferralCapture', () => {
  it('saves ?ref=AB12CD34 and reads it back', () => {
    const storage = memoryStorage()
    const capture = createReferralCapture({ storage, now: () => 0 })
    expect(capture.captureFrom('?utm=1&ref=AB12CD34')).toBe(true)
    expect(capture.pending()).toBe('AB12CD34')
  })

  it('ignores a missing or malformed ref and keeps what was saved before', () => {
    const capture = createReferralCapture({ storage: memoryStorage(), now: () => 0 })
    capture.captureFrom('?ref=AB12CD34')
    expect(capture.captureFrom('?foo=1')).toBe(false)
    expect(capture.captureFrom('?ref=<script>')).toBe(false)
    expect(capture.pending()).toBe('AB12CD34')
  })

  it('drops a code kept for more than 30 days', () => {
    const storage = memoryStorage()
    let now = 0
    const capture = createReferralCapture({ storage, now: () => now })
    capture.captureFrom('?ref=AB12CD34')
    now = 30 * DAY
    expect(capture.pending()).toBe('AB12CD34')
    now = 31 * DAY
    expect(capture.pending()).toBeNull()
    expect(storage.map.size).toBe(0)
  })

  it('survives a storage that throws', () => {
    const broken: ReferralStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const capture = createReferralCapture({ storage: broken, now: () => 0 })
    expect(capture.captureFrom('?ref=AB12CD34')).toBe(false)
    expect(capture.pending()).toBeNull()
  })
})

describe('claimPendingReferral', () => {
  it('claims exactly once, clears, and reports onClaimed', async () => {
    const capture = createReferralCapture({ storage: memoryStorage(), now: () => 0 })
    capture.captureFrom('?ref=AB12CD34')
    const claim = vi.fn(async () => {})
    const onClaimed = vi.fn()
    await claimPendingReferral({ capture, claim, onClaimed })
    await claimPendingReferral({ capture, claim, onClaimed })
    expect(claim).toHaveBeenCalledTimes(1)
    expect(claim).toHaveBeenCalledWith('AB12CD34')
    expect(onClaimed).toHaveBeenCalledTimes(1)
    expect(capture.pending()).toBeNull()
  })

  it('clears the code even when the server answers 400 (and tells onRejected)', async () => {
    const capture = createReferralCapture({ storage: memoryStorage(), now: () => 0 })
    capture.captureFrom('?ref=AB12CD34')
    const err = rejected(400, 'CAMPAIGN.REFERRAL_INVALID')
    const onRejected = vi.fn()
    const onClaimed = vi.fn()
    await claimPendingReferral({
      capture,
      claim: async () => {
        throw err
      },
      onClaimed,
      onRejected,
    })
    expect(capture.pending()).toBeNull()
    expect(onRejected).toHaveBeenCalledWith(err)
    expect(onClaimed).not.toHaveBeenCalled()
  })

  it('keeps the code when the call never reached the server', async () => {
    const capture = createReferralCapture({ storage: memoryStorage(), now: () => 0 })
    capture.captureFrom('?ref=AB12CD34')
    await claimPendingReferral({
      capture,
      claim: async () => {
        throw rejected(0, 'CLIENT.NETWORK_ERROR')
      },
    })
    expect(capture.pending()).toBe('AB12CD34')
  })

  it.each([401, 408, 429])(
    'keeps the code on a %i - the server did not say the code is wrong (sign-in lapsed, timeout, rate limit), so the next chance may work',
    async (status) => {
      const capture = createReferralCapture({ storage: memoryStorage(), now: () => 0 })
      capture.captureFrom('?ref=AB12CD34')
      const onRejected = vi.fn()
      await claimPendingReferral({
        capture,
        claim: async () => {
          throw rejected(status, 'X')
        },
        onRejected,
      })
      expect(capture.pending()).toBe('AB12CD34')
      expect(onRejected).not.toHaveBeenCalled()
    },
  )

  it('clears on 409 (the event is not active) like on 400', async () => {
    const capture = createReferralCapture({ storage: memoryStorage(), now: () => 0 })
    capture.captureFrom('?ref=AB12CD34')
    await claimPendingReferral({
      capture,
      claim: async () => {
        throw rejected(409, 'CAMPAIGN.NOT_ACTIVE')
      },
    })
    expect(capture.pending()).toBeNull()
  })

  it('does nothing without a pending code', async () => {
    const capture = createReferralCapture({ storage: memoryStorage(), now: () => 0 })
    const claim = vi.fn(async () => {})
    await claimPendingReferral({ capture, claim })
    expect(claim).not.toHaveBeenCalled()
  })
})
