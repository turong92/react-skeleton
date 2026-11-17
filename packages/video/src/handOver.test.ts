import { afterEach, describe, expect, it, vi } from 'vitest'
import { handOverWhenReady } from './handOver'

function fakeMedia() {
  const listeners = new Map<string, Set<() => void>>()
  const media = {
    readyState: 0,
    currentTime: 0,
    ranges: [] as Array<[number, number]>,
    get buffered() {
      const r = media.ranges
      return { length: r.length, start: (i: number) => r[i][0], end: (i: number) => r[i][1] }
    },
    addEventListener: (name: string, fn: () => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name)!.add(fn)
    },
    removeEventListener: (name: string, fn: () => void) => void listeners.get(name)?.delete(fn),
    fire: (name: string) => listeners.get(name)?.forEach((fn) => fn()),
  }
  return media
}

afterEach(() => vi.useRealTimers())

describe('handOverWhenReady', () => {
  it('waits while the sound keeps going, then jumps the video to where the sound is now', () => {
    const media = fakeMedia()
    let sound = 600
    const ready = vi.fn()
    handOverWhenReady(media as never, () => sound, ready)
    expect(ready).not.toHaveBeenCalled()

    // 첫 조각만 받았다 - 소리는 이미 그 뒤로 갔다
    sound = 603
    media.readyState = 4
    media.ranges = [[600, 603.2]]
    media.fire('canplay')
    expect(ready).not.toHaveBeenCalled()

    media.ranges = [[600, 612]]
    media.fire('progress')
    expect(ready).toHaveBeenCalledTimes(1)
    expect(media.currentTime).toBe(603)
  })

  it('hands over at once when nothing is playing as sound', () => {
    const media = fakeMedia()
    const ready = vi.fn()
    handOverWhenReady(media as never, () => null, ready)
    expect(ready).toHaveBeenCalledTimes(1)
    expect(media.currentTime).toBe(0)
  })

  it('gives up waiting after the time limit and plays what it has', () => {
    vi.useFakeTimers()
    const media = fakeMedia()
    const ready = vi.fn()
    handOverWhenReady(media as never, () => 700, ready, { timeoutMs: 8000 })
    vi.advanceTimersByTime(7999)
    expect(ready).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(ready).toHaveBeenCalledTimes(1)
    expect(media.currentTime).toBe(700)
  })

  it('does nothing after it is cancelled', () => {
    vi.useFakeTimers()
    const media = fakeMedia()
    const ready = vi.fn()
    const cancel = handOverWhenReady(media as never, () => 10, ready)
    cancel()
    media.readyState = 4
    media.ranges = [[0, 30]]
    media.fire('canplay')
    vi.advanceTimersByTime(10000)
    expect(ready).not.toHaveBeenCalled()
  })
})
