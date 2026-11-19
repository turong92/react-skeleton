import { describe, expect, it } from 'vitest'
import { DEFAULT_PC_WIDTH, deviceViewport, outerSize, PC_WIDTHS, PREVIEW_DEVICES } from './devices'

describe('devices', () => {
  it('four devices in picker order', () =>
    expect(PREVIEW_DEVICES).toEqual(['phone', 'tabletPortrait', 'tabletLandscape', 'pc']))

  it('phone and tablet portrait sizes', () => {
    expect(deviceViewport('phone')).toEqual({ width: 390, height: 844, frame: 'phone' })
    expect(deviceViewport('tabletPortrait')).toEqual({ width: 820, height: 1180, frame: 'tablet' })
  })

  it('tablet landscape swaps the portrait size', () =>
    expect(deviceViewport('tabletLandscape')).toEqual({
      width: 1180,
      height: 820,
      frame: 'tablet',
    }))

  it('pc follows the chosen width (1280 by default)', () => {
    expect(PC_WIDTHS).toEqual([1280, 1440, 1920])
    expect(DEFAULT_PC_WIDTH).toBe(1280)
    expect(deviceViewport('pc')).toEqual({ width: 1280, height: 800, frame: 'desktop' })
    expect(deviceViewport('pc', 1440)).toEqual({ width: 1440, height: 900, frame: 'desktop' })
    expect(deviceViewport('pc', 1920)).toEqual({ width: 1920, height: 1080, frame: 'desktop' })
  })

  it('outer size adds the frame, and a plain kind adds nothing', () => {
    expect(outerSize('phone')).toEqual({ width: 406, height: 860 })
    expect(outerSize('phone', undefined, 'plain')).toEqual({ width: 390, height: 844 })
    expect(outerSize('pc', 1280).height).toBe(824)
    expect(outerSize('pc', 1280).width).toBeCloseTo(1369.52, 2)
  })
})
