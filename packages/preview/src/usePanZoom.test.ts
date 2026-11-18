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
