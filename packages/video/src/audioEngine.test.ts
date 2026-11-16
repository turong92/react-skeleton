import { describe, expect, it, vi } from 'vitest'
import type { HlsCtor } from './attachSource'
import { createAudioEngine, type AudioLike } from './audioEngine'

function fakeAudio() {
  const el = {
    src: '',
    currentTime: 0,
    duration: NaN,
    volume: 1,
    muted: false,
    paused: true,
    play: vi.fn(() => {
      el.paused = false
      return Promise.resolve()
    }),
    pause: vi.fn(() => {
      el.paused = true
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getAttribute: () => (el.src ? el.src : null),
  }
  return el
}

function setup(engine: 'native' | 'hlsjs' | null = 'native') {
  const el = fakeAudio()
  const onFatal = vi.fn()
  const onPlayRejected = vi.fn()
  const instances: Array<{ loaded: string[]; destroyed: boolean; attached: unknown }> = []
  class Hls {
    static Events = { ERROR: 'e' }
    static isSupported = () => true
    loaded: string[] = []
    destroyed = false
    attached: unknown = null
    constructor() {
      instances.push(this)
    }
    on() {}
    loadSource(url: string) {
      this.loaded.push(url)
    }
    attachMedia(m: unknown) {
      this.attached = m
    }
    destroy() {
      this.destroyed = true
    }
  }
  const audio = createAudioEngine({
    engine: () => engine,
    loadHls: async () => Hls as unknown as HlsCtor,
    onFatal,
    onPlayRejected,
  })
  audio.setElement(el as unknown as AudioLike)
  return { audio, el, onFatal, onPlayRejected, instances }
}

describe('createAudioEngine', () => {
  it('puts the next song on the same element (never a new one) and plays it', () => {
    const { audio, el } = setup()
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false })
    expect(el.src).toBe('/a.m3u8')
    audio.start({ url: '/b.m3u8', at: 0, play: true, adopt: false })
    expect(el.src).toBe('/b.m3u8')
    expect(audio.element()).toBe(el)
    expect(el.play).toHaveBeenCalledTimes(2)
  })

  it('attaches hls.js to the same element and destroys the old one for the next song', async () => {
    const { audio, el, instances } = setup('hlsjs')
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false })
    await vi.waitFor(() => expect(instances).toHaveLength(1))
    expect(instances[0]).toMatchObject({ loaded: ['/a.m3u8'], attached: el })
    audio.start({ url: '/b.m3u8', at: 0, play: true, adopt: false })
    expect(instances[0]!.destroyed).toBe(true)
    await vi.waitFor(() => expect(instances).toHaveLength(2))
  })

  it('does not attach again when the player already started it (adopt), and does not play twice', () => {
    const { audio, el } = setup()
    el.src = '/woken.m3u8'
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: true, itemId: 'a' })
    expect(el.src).toBe('/woken.m3u8')
    expect(el.play).not.toHaveBeenCalled()
    expect(audio.loadedItem()).toBe('a')
  })

  it('starts paused when asked to', () => {
    const { audio, el } = setup()
    audio.start({ url: '/a.m3u8', at: 5, play: false, adopt: false })
    expect(el.play).not.toHaveBeenCalled()
  })

  it('reports a fatal problem when this device cannot play HLS or there is no element', () => {
    const { audio, onFatal } = setup(null)
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false })
    expect(onFatal).toHaveBeenCalledTimes(1)
  })

  it('pauses, resumes and restarts', () => {
    const { audio, el } = setup()
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false })
    el.currentTime = 42
    expect(audio.position()).toBe(42)
    audio.pause()
    expect(el.paused).toBe(true)
    audio.resume()
    expect(el.paused).toBe(false)
    audio.restart()
    expect(el.currentTime).toBe(0)
  })

  it('stop keeps the attached address so the woken element stays usable', () => {
    const { audio, el } = setup()
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false })
    audio.stop()
    expect(el.paused).toBe(true)
    expect(el.src).toBe('/a.m3u8')
  })

  it('has no source before the first start (e.g. after a reload)', () => {
    expect(setup().audio.loadedItem()).toBeNull()
  })

  it('wakes the element with the sound-only address without waiting', () => {
    const { audio, el } = setup()
    audio.wake('/a.m3u8')
    expect(el.src).toBe('/a.m3u8')
    expect(el.play).toHaveBeenCalled()
    expect(el.pause).toHaveBeenCalled()
  })
})

describe('createAudioEngine - which song is on the element', () => {
  it('remembers the song of the attached sound-only address, and forgets it on stop', () => {
    const { audio } = setup()
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false, itemId: 'a' })
    expect(audio.loadedItem()).toBe('a')
    audio.start({ url: '/b.m3u8', at: 0, play: true, adopt: false, itemId: 'b' })
    expect(audio.loadedItem()).toBe('b')
    audio.stop()
    expect(audio.loadedItem()).toBeNull()
  })

  it('cleans hls.js up when the element goes away', async () => {
    const { audio, instances } = setup('hlsjs')
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false, itemId: 'a' })
    await vi.waitFor(() => expect(instances).toHaveLength(1))
    audio.setElement(null)
    expect(instances[0]!.destroyed).toBe(true)
    expect(audio.loadedItem()).toBeNull()
  })
})

describe('createAudioEngine - refused play', () => {
  it('says so when the phone refuses to play (no gesture), so nobody claims it is playing', async () => {
    const { audio, el, onPlayRejected } = setup()
    el.play.mockReturnValue(
      Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })),
    )
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false })
    await Promise.resolve()
    await Promise.resolve()
    expect(onPlayRejected).toHaveBeenCalledTimes(1)
  })

  it('does not count a play that a newer song interrupted', async () => {
    const { audio, el, onPlayRejected } = setup()
    el.play.mockReturnValue(Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })))
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false })
    await Promise.resolve()
    await Promise.resolve()
    expect(onPlayRejected).not.toHaveBeenCalled()
  })
})

describe('createAudioEngine - the player joining a song the queue already plays', () => {
  it('keeps the hls.js instance that is playing it (no cut, no new attach)', async () => {
    const { audio, el, instances } = setup('hlsjs')
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false, itemId: 'a' })
    await vi.waitFor(() => expect(instances).toHaveLength(1))
    el.play.mockClear()
    audio.start({ url: '/a.m3u8', at: 30, play: true, adopt: true, itemId: 'a' }) // 큰 화면이 이어받는다
    expect(instances[0]!.destroyed).toBe(false)
    expect(instances).toHaveLength(1)
    expect(el.play).not.toHaveBeenCalled()
    expect(audio.loadedItem()).toBe('a')
  })

  it("still drops the old song's hls.js when the player adopts a different, natively woken one", async () => {
    const { audio, instances } = setup('hlsjs')
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false, itemId: 'a' })
    await vi.waitFor(() => expect(instances).toHaveLength(1))
    audio.start({ url: '/b.m3u8', at: 0, play: true, adopt: true, itemId: 'b' })
    expect(instances[0]!.destroyed).toBe(true)
    expect(audio.loadedItem()).toBe('b')
  })
})

describe('createAudioEngine - hls.js devices (chrome, android, desktop)', () => {
  it('does not wake the element with the playlist address - a non-native browser cannot play it and the failed load would sink the first play()', () => {
    const { audio, el } = setup('hlsjs')
    audio.wake('/a.m3u8')
    expect(el.src).toBe('')
    expect(el.play).not.toHaveBeenCalled()
  })

  it('plays again once hls.js has attached the stream, because attaching resets a play() made before it', async () => {
    const { audio, el, instances } = setup('hlsjs')
    const listeners = new Map<string, () => void>()
    el.addEventListener.mockImplementation(
      (type: string, fn: () => void) => void listeners.set(type, fn),
    )
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false, itemId: 'a' })
    await vi.waitFor(() => expect(instances).toHaveLength(1))
    el.paused = true // 붙이면서 처음의 play() 가 지워졌다
    el.play.mockClear()
    listeners.get('loadedmetadata')?.()
    expect(el.play).toHaveBeenCalledTimes(1)
  })

  it('does not play after metadata if the listener paused it meanwhile', async () => {
    const { audio, el, instances } = setup('hlsjs')
    const listeners = new Map<string, () => void>()
    el.addEventListener.mockImplementation(
      (type: string, fn: () => void) => void listeners.set(type, fn),
    )
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: false, itemId: 'a' })
    await vi.waitFor(() => expect(instances).toHaveLength(1))
    audio.pause()
    el.play.mockClear()
    listeners.get('loadedmetadata')?.()
    expect(el.play).not.toHaveBeenCalled()
  })

  it('applies volume and muted to the element, and seeks it', () => {
    const { audio, el } = setup()
    audio.setVolume(0.25, true)
    expect(el).toMatchObject({ volume: 0.25, muted: true })
    audio.seek(30)
    expect(el.currentTime).toBe(30)
  })

  it('reads the length as 0 until the element knows it', () => {
    const { audio, el } = setup()
    expect(audio.duration()).toBe(0)
    el.duration = 200
    expect(audio.duration()).toBe(200)
    el.duration = Infinity
    expect(audio.duration()).toBe(0)
  })
})
