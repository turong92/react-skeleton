import { describe, expect, it } from 'vitest'
import { nextDropState, reserveFor, type DropState } from './noticeStack'

describe('reserveFor', () => {
  it('wide, narrow, narrow with the panel open', () => {
    expect(reserveFor(true, 0)).toEqual({ top: 68, bottom: 108 })
    expect(reserveFor(true, 100)).toEqual({ top: 124, bottom: 108 })
    expect(reserveFor(false, 0)).toEqual({ top: 72, bottom: 96 })
    expect(reserveFor(false, 30)).toEqual({ top: 110, bottom: 96 })
    expect(reserveFor(false, 0, true)).toEqual({ top: 24, bottom: 24 })
    expect(reserveFor(false, 30, true)).toEqual({ top: 62, bottom: 24 })
  })
})

describe('nextDropState', () => {
  it('drops one notice per new measurement, stops at the end, resets on a new signature', () => {
    let s: DropState = { signature: '', level: 0, at: -1 }
    s = nextDropState(s, { over: true, stamp: 1, count: 2, signature: 'a' })
    expect(s).toEqual({ signature: 'a', level: 1, at: 1 })
    expect(nextDropState(s, { over: true, stamp: 1, count: 2, signature: 'a' })).toEqual(s)
    s = nextDropState(s, { over: true, stamp: 2, count: 2, signature: 'a' })
    expect(s.level).toBe(2)
    expect(nextDropState(s, { over: true, stamp: 3, count: 2, signature: 'a' }).level).toBe(2)
    expect(nextDropState(s, { over: false, stamp: 4, count: 2, signature: 'b' })).toEqual({
      signature: 'b',
      level: 0,
      at: -1,
    })
  })
})
