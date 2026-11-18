import { describe, expect, it } from 'vitest'
import { frameInsets, paintedBox } from './frame'

describe('frame', () => {
  it('desktop adds a bezel and a stand', () =>
    expect(frameInsets('desktop')).toEqual({ x: 6, top: 6, bottom: 18 }))

  it('phone, tablet and plain insets', () => {
    expect(frameInsets('phone')).toEqual({ x: 8, top: 8, bottom: 8 })
    expect(frameInsets('tablet')).toEqual({ x: 14, top: 14, bottom: 14 })
    expect(frameInsets('plain')).toEqual({ x: 0, top: 0, bottom: 0 })
  })

  it('only the desktop paints past its box (3% stand each side)', () => {
    expect(paintedBox('desktop', 1000)).toEqual({ left: 30, width: 1060 })
    expect(paintedBox('phone', 406)).toEqual({ left: 0, width: 406 })
  })
})
