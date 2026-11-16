import { describe, expect, it, vi } from 'vitest'
import type { HlsCtor } from './attachSource'
import { createAudioEngine, type AudioLike } from './audioEngine'

function fakeAudio() {
  const el = {
    src: '',
    currentTime: 0,
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
  })
  audio.setElement(el as unknown as AudioLike)
  return { audio, el, onFatal, instances }
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
    audio.start({ url: '/a.m3u8', at: 0, play: true, adopt: true })
    expect(el.src).toBe('/woken.m3u8')
    expect(el.play).not.toHaveBeenCalled()
    expect(audio.hasSource()).toBe(true)
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
    expect(setup().audio.hasSource()).toBe(false)
  })

  it('wakes the element with the sound-only address without waiting', () => {
    const { audio, el } = setup()
    audio.wake('/a.m3u8')
    expect(el.src).toBe('/a.m3u8')
    expect(el.play).toHaveBeenCalled()
    expect(el.pause).toHaveBeenCalled()
  })
})
