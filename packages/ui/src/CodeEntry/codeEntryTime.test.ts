import { createServerClock } from '@skeleton/time'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  expiryMillis,
  formatClock,
  secondsRemaining,
  stageOf,
  watchRemaining,
} from './codeEntryTime'

afterEach(() => vi.useRealTimers())

describe('the countdown maths (absolute instants, never a decrementing counter)', () => {
  it('formats mm:ss with a leading zero, and minutes past 59 keep counting (a 30 min code reads 30:00)', () => {
    expect(formatClock(582)).toBe('09:42')
    expect(formatClock(59)).toBe('00:59')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(1800)).toBe('30:00')
  })

  it('rounds the remaining time UP so 00:00 is shown only when the code really is over', () => {
    expect(secondsRemaining(10_000, 9_001)).toBe(1)
    expect(secondsRemaining(10_000, 10_000)).toBe(0)
    expect(secondsRemaining(10_000, 12_000)).toBe(0)
  })

  it('stages: calm, under a minute, under ten seconds, expired', () => {
    expect([601, 61, 60, 11, 10, 1, 0].map(stageOf)).toEqual([
      'normal',
      'normal',
      'minute',
      'minute',
      'ten',
      'ten',
      'expired',
    ])
  })

  it('accepts an ISO string, a Date or epoch ms; garbage is "no expiry"', () => {
    expect(expiryMillis('2026-10-07T00:10:00Z')).toBe(Date.parse('2026-10-07T00:10:00Z'))
    expect(expiryMillis(new Date(5))).toBe(5)
    expect(expiryMillis(7)).toBe(7)
    expect(expiryMillis('nope')).toBeNull()
    expect(expiryMillis(undefined)).toBeNull()
  })

  it('a device clock 5 minutes fast still reads the SERVER remaining time (offset from the Date header)', () => {
    const device = Date.parse('2026-10-07T00:05:00Z') // the phone says 00:05, the server says 00:00
    const clock = createServerClock(() => device)
    clock.observeDateHeader('Wed, 07 Oct 2026 00:00:00 GMT')
    const expiresAt = Date.parse('2026-10-07T00:10:00Z') // server: 10 minutes from 00:00
    expect(secondsRemaining(expiresAt, device)).toBe(300) // the naive device-clock answer: wrong
    expect(secondsRemaining(expiresAt, clock.now().getTime())).toBe(600)
  })
})

describe('watchRemaining', () => {
  it('reports each second from the clock, not by counting ticks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const seen: number[] = []
    const stop = watchRemaining({
      expiresAtMs: 5_000,
      now: Date.now,
      onChange: (s) => seen.push(s),
    })
    vi.advanceTimersByTime(2_000)
    stop()
    expect(seen.slice(0, 3)).toEqual([5, 4, 3])
  })

  it('a sleeping tab that wakes 4 minutes later jumps straight to the true remaining time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const seen: number[] = []
    const target = new EventTarget()
    const stop = watchRemaining({
      expiresAtMs: 600_000,
      now: Date.now,
      onChange: (s) => seen.push(s),
      visibility: target,
    })
    // the tab slept: the clock moved on 240 s but no timer ran
    vi.setSystemTime(240_000)
    target.dispatchEvent(new Event('visibilitychange'))
    stop()
    expect(seen.at(-1)).toBe(360)
  })

  it('stops its timer on cleanup (unmount)', () => {
    vi.useFakeTimers()
    const stop = watchRemaining({
      expiresAtMs: Date.now() + 9_000,
      now: Date.now,
      onChange: () => undefined,
    })
    expect(vi.getTimerCount()).toBe(1)
    stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('after 0 it keeps a slow watch: a server-corrected clock that arrives late brings the time back (an expiry judged on a wrong clock does not stick)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    let skew = 0 // 서버 시계 보정 — 처음에는 기기 시계가 앞서 있었다
    const seen: number[] = []
    watchRemaining({
      expiresAtMs: 10_000,
      now: () => Date.now() + skew,
      onChange: (s) => seen.push(s),
    })
    skew = 30_000 // 기기 시계가 앞선 것으로 읽혀 「이미 끝났다」
    vi.advanceTimersByTime(5_000)
    expect(seen.at(-1)).toBe(0)
    skew = 0 // 보정 표본이 도착했다 — 사실 시간이 남아 있었다
    vi.advanceTimersByTime(3_000)
    expect(seen.at(-1)).toBeGreaterThan(0)
  })

  it('once the expiry holds, the slow watch only reports a change (no chatter at 0)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const seen: number[] = []
    watchRemaining({ expiresAtMs: 2_000, now: Date.now, onChange: (s) => seen.push(s) })
    vi.advanceTimersByTime(30_000)
    expect(seen.filter((s) => s === 0)).toHaveLength(1)
  })
})
