import { describe, expect, it } from 'vitest'
import { afterFailure, grantExpired, planPlayback, type PlaybackEnv } from './playbackPlan'
import { fakeGrant } from './test/grant'

const HLS = 'application/vnd.apple.mpegurl'

/** 네이티브 HLS 가 있는 기기 - `codecs` 에 든 코덱만 튼다 */
const native = (codecs: string[] = ['avc1.640028']): PlaybackEnv => ({
  canPlayType: (mime) =>
    mime === HLS || codecs.some((c) => mime.includes(`"${c}"`)) || mime === 'video/mp4',
  mse: null,
})

/** 네이티브 HLS 는 없고 MSE 만 있는 기기 */
const mseOnly = (codecs: string[] = ['avc1.640028']): PlaybackEnv => ({
  canPlayType: () => false,
  mse: { isTypeSupported: (type) => codecs.some((c) => type.includes(`"${c}"`)) },
})

const none: PlaybackEnv = { canPlayType: () => false, mse: null }

describe('planPlayback', () => {
  it('plays the master first, then the original tier, then the compat tier', () => {
    const plan = planPlayback(fakeGrant(), native())
    expect(plan.engine).toBe('native')
    expect(plan.order).toEqual(['hls', 'orig', 'compat'])
    expect(plan.options).toEqual(['auto', 'compat', 'orig'])
  })

  it('judges the codec through MSE when hls.js is the engine', () => {
    const plan = planPlayback(fakeGrant({ codec: 'hvc1.1.6.L153.B0' }), mseOnly())
    expect(plan.engine).toBe('hlsjs')
    expect(plan.order).toEqual(['hls', 'compat'])
    expect(plan.options).toEqual(['auto', 'compat'])
  })

  it('puts the compat tier ahead of a big original that has a compat tier', () => {
    const plan = planPlayback(fakeGrant({ hls: undefined, big: true }), native())
    expect(plan.order).toEqual(['compat', 'orig'])
    expect(plan.options).toEqual(['auto', 'orig'])
  })

  it('offers 720p as pending while a big original has no compat tier yet', () => {
    const plan = planPlayback(fakeGrant({ hls: undefined, compat: undefined, big: true }), native())
    expect(plan.order).toEqual(['orig'])
    expect(plan.compatPending).toBe(true)
    expect(plan.options).toEqual(['auto', 'compat'])
  })

  it('skips the original when the device cannot decode its codec', () => {
    const plan = planPlayback(fakeGrant({ hls: undefined, codec: 'hvc1.1.6.L153.B0' }), native())
    expect(plan.order).toEqual(['compat'])
    expect(plan.options).toEqual(['auto'])
  })

  it('has nothing to play yet when only an undecodable original exists', () => {
    const plan = planPlayback(
      fakeGrant({ hls: undefined, compat: undefined, codec: 'hvc1.1.6.L153.B0' }),
      native(),
    )
    expect(plan.engine).toBe('native')
    expect(plan.order).toEqual([])
  })

  it('has no engine without native HLS or MSE', () => {
    expect(planPlayback(fakeGrant(), none)).toMatchObject({ engine: null, order: [] })
  })
})

describe('afterFailure', () => {
  const base = { order: ['hls', 'orig', 'compat'] as const, now: 1_000, canRefresh: true }

  it('moves on to the next untried step', () => {
    expect(afterFailure({ ...base, grant: fakeGrant(), tried: ['hls'], refreshed: false })).toEqual(
      { action: 'next', kind: 'orig' },
    )
  })

  it('gives up when every step was tried', () => {
    expect(
      afterFailure({
        ...base,
        grant: fakeGrant(),
        tried: ['hls', 'orig', 'compat'],
        refreshed: false,
      }),
    ).toEqual({ action: 'give-up' })
  })

  it('asks for a fresh grant once when the token has expired', () => {
    const grant = fakeGrant({ expiresAt: new Date(500).toISOString() })
    expect(afterFailure({ ...base, grant, tried: ['hls'], refreshed: false })).toEqual({
      action: 'refresh',
    })
    expect(afterFailure({ ...base, grant, tried: ['hls'], refreshed: true })).toEqual({
      action: 'next',
      kind: 'orig',
    })
  })

  it('does not refresh without a way to, or while the token is still good', () => {
    const expired = fakeGrant({ expiresAt: new Date(500).toISOString() })
    expect(
      afterFailure({
        ...base,
        grant: expired,
        canRefresh: false,
        tried: ['hls'],
        refreshed: false,
      }),
    ).toEqual({ action: 'next', kind: 'orig' })
    const live = fakeGrant({ expiresAt: new Date(10_000_000).toISOString() })
    expect(afterFailure({ ...base, grant: live, tried: ['hls'], refreshed: false })).toEqual({
      action: 'next',
      kind: 'orig',
    })
  })
})

describe('grantExpired', () => {
  it('treats a token that ends within 30 seconds as expired; a public grant never expires', () => {
    const at = (ms: number) => fakeGrant({ expiresAt: new Date(ms).toISOString() })
    expect(grantExpired(at(100_000), 80_000)).toBe(true)
    expect(grantExpired(at(100_000), 60_000)).toBe(false)
    expect(grantExpired(fakeGrant(), 10 ** 15)).toBe(false)
  })
})
