import { describe, expect, it } from 'vitest'
import { derivePanZoom, panZoomKey } from './usePanZoom'

describe('derivePanZoom', () => {
  it('fit puts the whole device in the viewport, centred, nothing to pan', () =>
    expect(
      derivePanZoom(
        { mode: 'fit', pan: null },
        { width: 800, height: 1600 },
        { width: 400, height: 400 },
      ),
    ).toEqual({ fit: 0.25, scale: 0.25, pan: { x: 100, y: 0 }, pannable: false }))

  it('actual size starts at the top centre and can pan', () =>
    expect(
      derivePanZoom(
        { mode: 'actual', pan: null },
        { width: 800, height: 1600 },
        { width: 400, height: 400 },
      ),
    ).toEqual({ fit: 0.25, scale: 1, pan: { x: -200, y: 0 }, pannable: true }))
})

describe('derivePanZoom - stage moves and size changes', () => {
  const content = { width: 800, height: 1600 }

  it('fit measures again when the stage size changes (0.25 -> 0.5 -> capped at 1)', () => {
    const fit = (viewport: { width: number; height: number }) =>
      derivePanZoom({ mode: 'fit', pan: null }, content, viewport)
    // 400/800 = 0.5 by width, 400/1600 = 0.25 by height
    expect(fit({ width: 400, height: 400 })).toMatchObject({ fit: 0.25, scale: 0.25 })
    // height 800/1600 = 0.5, width 400/800 = 0.5 -> 0.5, device 400 wide fills the stage, pan x 0
    expect(fit({ width: 400, height: 800 })).toMatchObject({
      scale: 0.5,
      pan: { x: 0, y: 0 },
      pannable: false,
    })
    // 1000/800 and 2000/1600 are both 1.25 -> capped at 1, centred: (1000 - 800) / 2, (2000 - 1600) / 2
    expect(fit({ width: 1000, height: 2000 })).toMatchObject({ scale: 1, pan: { x: 100, y: 200 } })
  })

  it('a manual scale is kept on resize, and a pan that no longer fits is clamped', () => {
    const view = { mode: 1, pan: { x: -300, y: -900 } } as const
    // 800x1600 in 400x400: x in [-400, 0], y in [-1200, 0] -> unchanged
    expect(derivePanZoom(view, content, { width: 400, height: 400 }).pan).toEqual({
      x: -300,
      y: -900,
    })
    // stage grows to 700x1500: x in [-100, 0], y in [-100, 0]
    expect(derivePanZoom(view, content, { width: 700, height: 1500 })).toMatchObject({
      scale: 1,
      pan: { x: -100, y: -100 },
    })
    // stage bigger than the device: centred again, nothing to pan
    expect(derivePanZoom(view, content, { width: 1000, height: 2000 })).toMatchObject({
      pan: { x: 100, y: 200 },
      pannable: false,
    })
  })

  it('stops at the ends: past the edges the pan is clamped on every side', () => {
    const viewport = { width: 400, height: 400 }
    const at = (x: number, y: number) =>
      derivePanZoom({ mode: 'actual', pan: { x, y } }, content, viewport).pan
    expect(at(-9999, -9999)).toEqual({ x: -400, y: -1200 }) // right / bottom edge
    expect(at(9999, 9999)).toEqual({ x: 0, y: 0 }) // left / top edge
  })

  it('a numeric scale is clamped to 2 above and to min(0.5, fit) below', () => {
    const viewport = { width: 400, height: 400 } // fit 0.25
    const scale = (mode: number) => derivePanZoom({ mode, pan: null }, content, viewport).scale
    expect(scale(5)).toBe(2)
    expect(scale(0.1)).toBe(0.25)
    expect(scale(0.75)).toBe(0.75)
    // a bigger stage (fit 0.5): the floor is 0.5
    expect(
      derivePanZoom({ mode: 0.1, pan: null }, content, { width: 800, height: 800 }).scale,
    ).toBe(0.5)
  })
})

describe('panZoomKey', () => {
  const k = (key: string, mods = {}) =>
    panZoomKey({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods })

  it('arrows pan 40 (shift ×4), + = zoom in, − _ zoom out, 0 fits, modifiers are left alone', () => {
    expect(k('ArrowLeft')).toEqual({ pan: { x: 40, y: 0 } })
    expect(k('ArrowDown', { shiftKey: true })).toEqual({ pan: { x: 0, y: -160 } })
    expect(k('=')).toEqual({ zoom: 1 })
    expect(k('_')).toEqual({ zoom: -1 })
    expect(k('0')).toEqual({ fit: true })
    expect(k('+', { ctrlKey: true })).toBeNull()
    expect(k('a')).toBeNull()
  })
})
