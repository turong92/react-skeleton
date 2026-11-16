import { describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from './audioEngine'
import type { MediaOutput } from './mediaOutput'
import type { QueueItem } from './playQueue'
import { createQueueController } from './queueController'
import type { QueueStorage } from './queueStorage'

/** 진행 막대 · 음량: 대기열 `<audio>` · 화면 영상 · 유튜브 세 종류를 한 손잡이로 */
function fakeEngine() {
  let loaded: string | null = null
  const engine = {
    time: 0,
    length: 0,
    setElement: () => {},
    element: () => null,
    wake: () => {},
    start: vi.fn((r: { itemId?: string }) => {
      loaded = r.itemId ?? null
    }),
    stop: vi.fn(() => {
      loaded = null
    }),
    pause: () => {},
    resume: () => {},
    restart: () => {},
    position: () => engine.time,
    duration: () => engine.length,
    setVolume: vi.fn(),
    seek: vi.fn((t: number) => {
      engine.time = t
    }),
    loadedItem: () => loaded,
  }
  return engine
}

function fakeOutput(time = 0, length = 0) {
  const out = {
    time,
    length,
    read: () => ({ currentTime: out.time, duration: out.length }),
    seek: vi.fn((t: number) => {
      out.time = t
    }),
    applyVolume: vi.fn(),
  }
  return out satisfies MediaOutput & Record<string, unknown>
}

const song = (id: string): QueueItem => ({
  kind: 'media',
  id,
  title: id,
  source: { src: `/${id}/o.m3u8`, audio: `/${id}/a.m3u8` },
})
const clip = (id: string): QueueItem => ({
  kind: 'media',
  id,
  title: id,
  source: { src: `/${id}/o.m3u8` },
})

function setup(items: QueueItem[], storage?: QueueStorage) {
  const engine = fakeEngine()
  const c = createQueueController({
    audio: engine as unknown as AudioEngine,
    storage,
    storageKey: 'q',
    random: () => 0,
  })
  c.setQueue(items)
  return { c, engine }
}

describe('queue progress', () => {
  it('reads the shared <audio> while a song plays as sound, and seeks it', () => {
    const { c, engine } = setup([song('a')])
    c.play()
    engine.time = 12
    engine.length = 225
    expect(c.progress()).toEqual({ currentTime: 12, duration: 225 })
    c.seek(100)
    expect(engine.seek).toHaveBeenCalledWith(100)
    expect(c.progress().currentTime).toBe(100)
  })

  it('reads the registered output in video mode (our video or youtube) and seeks that', () => {
    const { c, engine } = setup([clip('a')])
    c.play()
    const out = fakeOutput(7, 60)
    c.registerOutput(out)
    expect(c.progress()).toEqual({ currentTime: 7, duration: 60 })
    c.seek(30)
    expect(out.seek).toHaveBeenCalledWith(30)
    expect(engine.seek).not.toHaveBeenCalled()
  })

  it('is 0 / 0 before anything is loaded: no output yet, or the audio element holds another song', () => {
    const video = setup([clip('a')])
    video.c.play()
    expect(video.c.progress()).toEqual({ currentTime: 0, duration: 0 })
    const sound = setup([song('a')])
    sound.engine.time = 50
    sound.engine.length = 99
    expect(sound.c.progress()).toEqual({ currentTime: 0, duration: 0 })
  })

  it('goes back to 0 when the output is unregistered (the song changed)', () => {
    const { c } = setup([clip('a')])
    c.play()
    const off = c.registerOutput(fakeOutput(7, 60))
    off()
    expect(c.progress()).toEqual({ currentTime: 0, duration: 0 })
  })

  it('keeps a newer output when an older one unregisters late', () => {
    const { c } = setup([clip('a')])
    c.play()
    const offOld = c.registerOutput(fakeOutput(1, 10))
    c.registerOutput(fakeOutput(2, 20))
    offOld()
    expect(c.progress().duration).toBe(20)
  })

  it('returns the same object while nothing moved (so a store subscriber does not redraw)', () => {
    const { c } = setup([song('a')])
    c.play()
    expect(c.progress()).toBe(c.progress())
  })

  it('tells subscribers when the time moves, and stops the timer after the last one leaves', () => {
    vi.useFakeTimers()
    try {
      const { c, engine } = setup([song('a')])
      c.play()
      const heard = vi.fn()
      const off = c.subscribeProgress(heard)
      engine.time = 3
      engine.length = 100
      vi.advanceTimersByTime(300)
      expect(heard).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(300)
      expect(heard).toHaveBeenCalledTimes(1)
      off()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('queue volume', () => {
  it('starts at full volume, unmuted', () => {
    const { c } = setup([song('a')])
    expect(c.getState()).toMatchObject({ volume: 1, muted: false })
  })

  it('applies a change to the shared <audio> and to the registered output', () => {
    const { c, engine } = setup([clip('a')])
    const out = fakeOutput()
    c.registerOutput(out)
    c.setVolume(0.4)
    c.setMuted(true)
    expect(engine.setVolume).toHaveBeenLastCalledWith(0.4, true)
    expect(out.applyVolume).toHaveBeenLastCalledWith(0.4, true)
    expect(c.getState()).toMatchObject({ volume: 0.4, muted: true })
  })

  it('gives a newly created output (the next song, a new <video>) the current volume at once', () => {
    const { c } = setup([clip('a')])
    c.setVolume(0.2)
    const out = fakeOutput()
    c.registerOutput(out)
    expect(out.applyVolume).toHaveBeenCalledWith(0.2, false)
  })

  it('keeps volume inside 0..1 and ignores what is not a number', () => {
    const { c } = setup([song('a')])
    c.setVolume(5)
    expect(c.getState().volume).toBe(1)
    c.setVolume(-1)
    expect(c.getState().volume).toBe(0)
    c.setVolume(NaN)
    expect(c.getState().volume).toBe(0)
  })

  it('is saved and comes back after a reload, even with an empty queue', () => {
    const data: Record<string, string> = {}
    const storage: QueueStorage = {
      getItem: (k) => data[k] ?? null,
      setItem: (k, v) => void (data[k] = v),
      removeItem: (k) => void delete data[k],
    }
    const first = setup([song('a')], storage)
    first.c.setVolume(0.3)
    first.c.setMuted(true)
    const second = setup([], storage)
    second.c.restore()
    expect(second.c.getState()).toMatchObject({ volume: 0.3, muted: true })
    expect(second.engine.setVolume).toHaveBeenLastCalledWith(0.3, true)
  })

  it('puts the volume on a freshly attached <audio> element', () => {
    const { c, engine } = setup([song('a')])
    c.setVolume(0.6)
    engine.setVolume.mockClear()
    c.attachElement({ addEventListener: () => {}, removeEventListener: () => {} } as never)
    expect(engine.setVolume).toHaveBeenCalledWith(0.6, false)
  })
})
