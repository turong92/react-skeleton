import { describe, expect, it, vi } from 'vitest'
import { canSetVolumeOf, elementOutput, youtubeOutput } from './mediaOutput'

describe('elementOutput', () => {
  const el = () => ({ currentTime: 12, duration: 225, volume: 1, muted: false })

  it('reads the time and length of the element and seeks by writing currentTime', () => {
    const e = el()
    const out = elementOutput(e)
    expect(out.read()).toEqual({ currentTime: 12, duration: 225 })
    out.seek(40)
    expect(e.currentTime).toBe(40)
  })

  it('turns an unknown length (NaN, Infinity for a live stream) into 0', () => {
    expect(elementOutput({ ...el(), duration: NaN }).read().duration).toBe(0)
    expect(elementOutput({ ...el(), duration: Infinity }).read().duration).toBe(0)
  })

  it('applies volume and muted to the element', () => {
    const e = el()
    elementOutput(e).applyVolume(0.3, true)
    expect(e).toMatchObject({ volume: 0.3, muted: true })
  })
})

describe('youtubeOutput', () => {
  const player = () => ({
    getCurrentTime: vi.fn(() => 5.5),
    getDuration: vi.fn(() => 180),
    seekTo: vi.fn(),
    setVolume: vi.fn(),
    mute: vi.fn(),
    unMute: vi.fn(),
  })

  it('reads and seeks through the player (seekTo allows seeking ahead of what is buffered)', () => {
    const p = player()
    const out = youtubeOutput(p)
    expect(out.read()).toEqual({ currentTime: 5.5, duration: 180 })
    out.seek(60)
    expect(p.seekTo).toHaveBeenCalledWith(60, true)
  })

  it('maps volume 0..1 to 0..100 and muted to mute / unMute', () => {
    const p = player()
    const out = youtubeOutput(p)
    out.applyVolume(0.256, true)
    expect(p.setVolume).toHaveBeenCalledWith(26)
    expect(p.mute).toHaveBeenCalled()
    out.applyVolume(1, false)
    expect(p.setVolume).toHaveBeenLastCalledWith(100)
    expect(p.unMute).toHaveBeenCalled()
  })

  it('reads 0 before the player knows its length', () => {
    const p = { ...player(), getDuration: () => NaN }
    expect(youtubeOutput(p).read().duration).toBe(0)
  })
})

describe('canSetVolumeOf', () => {
  it('is true when the element keeps the 0.5 it was given', () => {
    const e = { volume: 1 }
    expect(canSetVolumeOf(e)).toBe(true)
  })

  it('is false when the device ignores the write (iPhone: volume is read-only)', () => {
    const e = {
      get volume() {
        return 1
      },
      set volume(_value: number) {},
    }
    expect(canSetVolumeOf(e)).toBe(false)
  })
})
