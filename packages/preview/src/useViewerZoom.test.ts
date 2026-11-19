import { describe, expect, it } from 'vitest'
import { besideFits, besideRoom, keepMeasured } from './useViewerZoom'

describe('keepMeasured — a 0 measured while the pill is gone does not erase the reference width', () => {
  it('keeps the last measured width when the new one is 0 (no pill)', () => {
    expect(keepMeasured(260, 0)).toBe(260)
  })

  it('takes a new measured width', () => {
    expect(keepMeasured(260, 240)).toBe(240)
    expect(keepMeasured(0, 240)).toBe(240)
  })
})

const phone = {
  stage: { width: 820, height: 1100 },
  content: { width: 406, height: 860 },
  gutter: 16,
}

describe('besideRoom — the space beside the device for the shrunk pill', () => {
  it('when height limits the scale, the room is wider than when only the width is looked at', () => {
    const widthOnly = (phone.stage.width - phone.content.width) / 2
    expect(besideRoom({ ...phone, panel: 400, manualScale: 0 })).toBeGreaterThan(widthOnly)
  })

  it('a hand-set scale bigger than fit is measured instead (the pill never overlaps the device)', () => {
    const fitted = besideRoom({ ...phone, panel: 400, manualScale: 0 })
    expect(besideRoom({ ...phone, panel: 400, manualScale: 0.95 })).toBeLessThan(fitted)
  })

  it('a device that fills the width has almost no room beside it', () => {
    const wide = {
      stage: { width: 820, height: 1100 },
      content: { width: 1452, height: 900 },
      gutter: 16,
    }
    expect(besideRoom({ ...wide, panel: 0, manualScale: 0 })).toBeLessThan(40)
  })
})

describe('besideFits — beside ↔ stacked hysteresis', () => {
  const need = 230

  it('near the threshold it keeps the current place (a few px of jitter does not flicker)', () => {
    for (const room of [need - 3, need, need + 3]) {
      expect(besideFits(room, need, true), `beside at ${room}`).toBe(true)
      expect(besideFits(room, need, false), `stacked at ${room}`).toBe(false)
    }
  })

  it('goes beside when wide enough and stacks when narrow enough', () => {
    expect(besideFits(need + 20, need, false)).toBe(true)
    expect(besideFits(need - 20, need, true)).toBe(false)
  })
})
