import { describe, expect, it } from 'vitest'
import { clampPan, clampScale, fitScale, nextStep, zoomAround, zoomEnds, ZOOM_STEPS } from './zoom'

const PHONE = { width: 414, height: 900 }

describe('fitScale', () => {
  it('fits the narrower of width and height', () => {
    expect(fitScale(PHONE, { width: 207, height: 1800 })).toBe(0.5)
    expect(fitScale(PHONE, { width: 1000, height: 450 })).toBe(0.5)
  })

  it('never exceeds 1 by default', () => {
    expect(fitScale(PHONE, { width: 2000, height: 2000 })).toBe(1)
  })

  it('looks only at the width when the height is null', () => {
    expect(fitScale(PHONE, { width: 207, height: null })).toBe(0.5)
    expect(fitScale(PHONE, { width: 1000, height: null })).toBe(1)
  })

  it('does not shrink along an axis that is not measured yet (0)', () => {
    expect(fitScale(PHONE, { width: 0, height: null })).toBe(1)
    expect(fitScale(PHONE, { width: 207, height: 0 })).toBe(0.5)
  })

  it('fitScale keeps 1 on an unmeasured (0) axis', () =>
    expect(fitScale({ width: 406, height: 860 }, { width: 0, height: 0 })).toBe(1))

  it('fitScale grows up to max when the box is bigger', () =>
    expect(fitScale({ width: 406, height: 860 }, { width: 900, height: 1400 }, 1.5)).toBe(1.5))
})

describe('nextStep', () => {
  it('steps up and down', () => {
    expect(ZOOM_STEPS).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2])
    expect(nextStep(1, 1)).toBe(1.25)
    expect(nextStep(1, -1)).toBe(0.75)
  })

  it('between steps it goes to the nearest step in that direction', () => {
    expect(nextStep(0.6, 1)).toBe(0.75)
    expect(nextStep(0.6, -1)).toBe(0.5)
    expect(nextStep(1.3, -1)).toBe(1.25)
  })

  it('at the ends: nothing above 2 or below 0.5, and + from a fit under 0.5 goes to 0.5', () => {
    expect(nextStep(2, 1)).toBe(2)
    expect(nextStep(0.5, -1)).toBe(0.5)
    expect(nextStep(0.2, -1)).toBe(0.2)
    expect(nextStep(0.2, 1)).toBe(0.5)
    expect(nextStep(3, -1)).toBe(2)
  })

  it('+ never shrinks a scale above 2', () => {
    expect(nextStep(3, 1)).toBe(3)
    expect(nextStep(2.0000001, 1)).toBe(2.0000001)
  })

  it('floating point noise does not keep it on the same step', () => {
    expect(nextStep(0.75 + 1e-9, 1)).toBe(1)
    expect(nextStep(0.75 - 1e-9, -1)).toBe(0.5)
  })
})

describe('clampPan', () => {
  const viewport = { width: 400, height: 300 }
  it('centres content that is smaller than the viewport', () => {
    expect(clampPan({ x: 500, y: -500 }, { width: 200, height: 100 }, viewport)).toEqual({
      x: 100,
      y: 100,
    })
  })

  it('stops at the edges for larger content', () => {
    const content = { width: 1920, height: 1080 }
    expect(clampPan({ x: 50, y: 50 }, content, viewport)).toEqual({ x: 0, y: 0 })
    expect(clampPan({ x: -9999, y: -9999 }, content, viewport)).toEqual({ x: -1520, y: -780 })
    expect(clampPan({ x: -300, y: -200 }, content, viewport)).toEqual({ x: -300, y: -200 })
  })

  it('works per axis', () => {
    expect(clampPan({ x: -9999, y: 0 }, { width: 800, height: 100 }, viewport)).toEqual({
      x: -400,
      y: 100,
    })
  })
})

describe('clampScale', () => {
  it('top is 2, bottom is the smaller of 0.5 and the fit scale', () => {
    expect(clampScale(3, 0.8)).toBe(2)
    expect(clampScale(0.3, 0.8)).toBe(0.5)
    expect(clampScale(0.3, 0.2)).toBe(0.3)
    expect(clampScale(0.1, 0.2)).toBe(0.2)
    expect(clampScale(Number.NaN, 0.2)).toBe(1)
  })
})

describe('zoomAround', () => {
  it('keeps the content point under the origin in place', () => {
    const pan = { x: -100, y: -50 }
    const origin = { x: 200, y: 150 }
    const next = zoomAround(pan, origin, 1, 2)
    expect(next).toEqual({ x: -400, y: -250 })
    expect(zoomAround(next, origin, 2, 1)).toEqual(pan)
  })
})

describe('zoomEnds', () => {
  it('zoomEnds — 2 is the top, min(0.5, fit) the bottom', () => {
    expect(zoomEnds(2, 0.4)).toEqual({ atMax: true, atMin: false })
    expect(zoomEnds(0.4, 0.4)).toEqual({ atMax: false, atMin: true })
    expect(zoomEnds(1, 0.4)).toEqual({ atMax: false, atMin: false })
  })
})
