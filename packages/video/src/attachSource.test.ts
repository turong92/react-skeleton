import { describe, expect, it, vi } from 'vitest'
import { attachSource, type HlsCtor, type HlsLike } from './attachSource'

function fakeVideo() {
  const listeners = new Map<string, () => void>()
  return {
    src: '',
    currentTime: 0,
    addEventListener: (name: string, fn: () => void) => void listeners.set(name, fn),
    removeEventListener: (name: string) => void listeners.delete(name),
    fire: (name: string) => listeners.get(name)?.(),
  }
}

function fakeHls(supported = true) {
  const instances: Array<
    HlsLike & { handlers: Record<string, (e: string, d: unknown) => void>; loaded: string[] }
  > = []
  class Hls {
    static Events = { ERROR: 'hlsError' }
    static isSupported = () => supported
    handlers: Record<string, (e: string, d: unknown) => void> = {}
    loaded: string[] = []
    attached: unknown = null
    destroyed = false
    constructor() {
      instances.push(this as never)
    }
    on(name: string, fn: (e: string, d: unknown) => void) {
      this.handlers[name] = fn
    }
    loadSource(url: string) {
      this.loaded.push(url)
    }
    attachMedia(v: unknown) {
      this.attached = v
    }
    destroy() {
      this.destroyed = true
    }
  }
  return { Hls: Hls as unknown as HlsCtor, instances }
}

describe('attachSource', () => {
  it('uses the native player and never loads hls.js', () => {
    const video = fakeVideo()
    const loadHls = vi.fn()
    attachSource(video as never, 'https://x/a.m3u8', 'native', { loadHls, onFatal: vi.fn() })
    expect(video.src).toBe('https://x/a.m3u8')
    expect(loadHls).not.toHaveBeenCalled()
  })

  it('loads hls.js only when attaching, then wires the source and the video', async () => {
    const video = fakeVideo()
    const { Hls, instances } = fakeHls()
    const loadHls = vi.fn(async () => Hls)
    expect(loadHls).not.toHaveBeenCalled()
    attachSource(video as never, 'https://x/a.m3u8', 'hlsjs', { loadHls, onFatal: vi.fn() })
    await vi.waitFor(() => expect(instances).toHaveLength(1))
    expect(instances[0].loaded).toEqual(['https://x/a.m3u8'])
    expect((instances[0] as never as { attached: unknown }).attached).toBe(video)
  })

  it('reports only fatal hls.js errors', async () => {
    const video = fakeVideo()
    const { Hls, instances } = fakeHls()
    const onFatal = vi.fn()
    attachSource(video as never, 'u', 'hlsjs', { loadHls: async () => Hls, onFatal })
    await vi.waitFor(() => expect(instances).toHaveLength(1))
    instances[0].handlers.hlsError('hlsError', { fatal: false })
    expect(onFatal).not.toHaveBeenCalled()
    instances[0].handlers.hlsError('hlsError', { fatal: true })
    expect(onFatal).toHaveBeenCalledTimes(1)
  })

  it('reports a fatal failure when MSE is unsupported or the chunk cannot load', async () => {
    const a = vi.fn()
    attachSource(fakeVideo() as never, 'u', 'hlsjs', {
      loadHls: async () => fakeHls(false).Hls,
      onFatal: a,
    })
    const b = vi.fn()
    attachSource(fakeVideo() as never, 'u', 'hlsjs', {
      loadHls: async () => {
        throw new Error('offline')
      },
      onFatal: b,
    })
    await vi.waitFor(() => expect(a).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(b).toHaveBeenCalledTimes(1))
  })

  it('creates nothing when destroyed before hls.js arrives, and destroys the engine after', async () => {
    const { Hls, instances } = fakeHls()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const early = attachSource(fakeVideo() as never, 'u', 'hlsjs', {
      loadHls: async () => (await gate, Hls),
      onFatal: vi.fn(),
    })
    early.destroy()
    release()
    await new Promise((r) => setTimeout(r, 0))
    expect(instances).toHaveLength(0)

    const late = attachSource(fakeVideo() as never, 'u', 'hlsjs', {
      loadHls: async () => Hls,
      onFatal: vi.fn(),
    })
    await vi.waitFor(() => expect(instances).toHaveLength(1))
    late.destroy()
    expect((instances[0] as never as { destroyed: boolean }).destroyed).toBe(true)
  })

  it('seeks to the wanted time once metadata is known', () => {
    const video = fakeVideo()
    attachSource(video as never, 'u', 'native', {
      loadHls: vi.fn(),
      onFatal: vi.fn(),
      startAt: 12.5,
    })
    expect(video.currentTime).toBe(0)
    video.fire('loadedmetadata')
    expect(video.currentTime).toBe(12.5)
  })
})
