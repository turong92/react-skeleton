import { describe, expect, it } from 'vitest'
import { MIN_VISIBLE, outerScrollTop, visibleWindow } from './scroll'

describe('visibleWindow', () => {
  it('the visible window is the part of the tall frame inside the scroll box', () =>
    expect(
      visibleWindow({ viewTop: 0, viewBottom: 800, frameTop: -1000, docH: 3000, scale: 1 }),
    ).toEqual({
      top: 1000,
      height: 800,
    }))

  it('no window when less than 120px shows', () => {
    expect(MIN_VISIBLE).toBe(120)
    expect(
      visibleWindow({ viewTop: 0, viewBottom: 100, frameTop: 0, docH: 3000, scale: 1 }),
    ).toBeNull()
  })

  it('divides by the scale', () =>
    expect(
      visibleWindow({ viewTop: 0, viewBottom: 400, frameTop: 0, docH: 3000, scale: 0.5 }),
    ).toEqual({
      top: 0,
      height: 800,
    }))
})

describe('outerScrollTop', () => {
  it('outerScrollTop leaves the head and the room above the target', () => {
    expect(
      outerScrollTop({ scrollY: 100, frameTop: 50, top: 400, scale: 0.5, headH: 48, room: 28 }),
    ).toBe(274)
    expect(
      outerScrollTop({ scrollY: 0, frameTop: 0, top: 10, scale: 1, headH: 48, room: 28 }),
    ).toBe(0)
  })
})
