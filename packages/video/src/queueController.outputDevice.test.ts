import { describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from './audioEngine'
import type { MediaOutput } from './mediaOutput'
import type { QueueItem } from './playQueue'
import { createQueueController } from './queueController'
import type { QueueStorage } from './queueStorage'

/** 소리 내보낼 장치 고르기: 대기열 `<audio>` · 화면 영상에 같이 걸리고, 장치 목록은 권한 · 장치 변화를 따른다 */

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
const tube = (id: string): QueueItem => ({ kind: 'youtube', id, title: id, videoId: id })

const device = (deviceId: string, label = '') => ({ kind: 'audiooutput', deviceId, label })

function fakeMedia(initial: ReturnType<typeof device>[]) {
  const listeners = new Set<() => void>()
  const media = {
    devices: initial,
    stream: { getTracks: () => [{ stop: vi.fn() }] },
    enumerateDevices: vi.fn(async () => media.devices),
    getUserMedia: vi.fn(async () => {
      // 권한을 받으면 이름이 보인다
      media.devices = media.devices.map((d) => ({ ...d, label: `name-${d.deviceId}` }))
      return media.stream
    }),
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    change: (devices: ReturnType<typeof device>[]) => {
      media.devices = devices
      for (const l of listeners) l()
    },
    listening: () => listeners.size,
  }
  return media
}

function fakeStorage(): QueueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

function setup(options: { media?: ReturnType<typeof fakeMedia>; outputDeviceKey?: string } = {}) {
  const storage = fakeStorage()
  const audio = {
    setSink: vi.fn(),
    setVolume: vi.fn(),
    wake: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    loadedItem: () => null,
    position: () => 0,
    duration: () => 0,
  }
  const c = createQueueController({
    audio: audio as unknown as AudioEngine,
    storage,
    storageKey: 'q',
    random: () => 0,
    outputDeviceKey: options.outputDeviceKey,
    mediaDevices: options.media,
  })
  return { c, audio, storage }
}

const output = () =>
  ({
    read: () => ({ currentTime: 0, duration: 0 }),
    seek: vi.fn(),
    applyVolume: vi.fn(),
    setSink: vi.fn(),
  }) satisfies MediaOutput

function defer<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('choosing the output device', () => {
  it('sends the sound element and the registered video to the chosen device', () => {
    const { c, audio } = setup()
    c.setQueue([clip('a')])
    const out = output()
    c.registerOutput(out)
    c.setOutputDevice('speaker')
    expect(c.getState().outputDevice).toBe('speaker')
    expect(audio.setSink).toHaveBeenCalledWith('speaker')
    expect(out.setSink).toHaveBeenLastCalledWith('speaker')
  })

  it('puts a video that appears later (song change, picture <-> sound) on the chosen device', () => {
    const { c } = setup()
    c.setOutputDevice('speaker')
    const next = output()
    c.registerOutput(next)
    expect(next.setSink).toHaveBeenCalledWith('speaker')
  })

  it('leaves a new video alone while the default device is chosen', () => {
    const { c } = setup()
    const next = output()
    c.registerOutput(next)
    expect(next.setSink).not.toHaveBeenCalled()
  })

  it('remembers the choice under the key the app gives, and restores it', () => {
    const first = setup({ outputDeviceKey: 'app.sink' })
    first.c.setOutputDevice('speaker')
    expect(first.storage.data.get('app.sink')).toBe('speaker')
    const second = setup({ outputDeviceKey: 'app.sink' })
    second.storage.data.set('app.sink', 'speaker')
    second.c.restore()
    expect(second.c.getState().outputDevice).toBe('speaker')
    expect(second.audio.setSink).toHaveBeenCalledWith('speaker')
  })

  it('stores nothing and restores nothing without a key', () => {
    const { c, storage } = setup()
    c.setOutputDevice('speaker')
    expect([...storage.data.keys()].filter((k) => k !== 'q.volume')).toEqual([])
  })

  it('removes the stored value when the default is chosen again', () => {
    const { c, storage } = setup({ outputDeviceKey: 'app.sink' })
    c.setOutputDevice('speaker')
    c.setOutputDevice('')
    expect(storage.data.has('app.sink')).toBe(false)
  })
})

describe('a device the browser refuses', () => {
  it('falls back to the default and forgets the saved choice', async () => {
    const { c, audio, storage } = setup({ outputDeviceKey: 'app.sink' })
    audio.setSink.mockResolvedValueOnce(false)
    c.setOutputDevice('bt')
    expect(storage.data.get('app.sink')).toBe('bt')
    await flush()
    expect(c.getState().outputDevice).toBe('')
    expect(storage.data.has('app.sink')).toBe(false)
    expect(audio.setSink).toHaveBeenLastCalledWith('')
  })

  it('leaves a newer choice alone when the older one is refused late', async () => {
    const { c, audio, storage } = setup({ outputDeviceKey: 'app.sink' })
    const late = defer<boolean>()
    audio.setSink.mockReturnValueOnce(late.promise)
    c.setOutputDevice('bt')
    c.setOutputDevice('speaker')
    late.resolve(false)
    await flush()
    expect(c.getState().outputDevice).toBe('speaker')
    expect(storage.data.get('app.sink')).toBe('speaker')
  })

  it('does not forget a saved device that is only switched off right now (restore)', async () => {
    const { c, audio, storage } = setup({ outputDeviceKey: 'app.sink' })
    storage.data.set('app.sink', 'bt')
    audio.setSink.mockResolvedValueOnce(false)
    c.restore()
    await flush()
    expect(c.getState().outputDevice).toBe('')
    expect(storage.data.get('app.sink')).toBe('bt')
  })
})

describe('the device list', () => {
  it('lists audio outputs without the browser-made duplicates, and watches device changes', async () => {
    const media = fakeMedia([device('default', 'Default'), device('a', 'A'), device('b', 'B')])
    const { c } = setup({ media })
    const stop = c.watchOutputDevices()
    await flush()
    expect(c.getState().outputDevices.map((d) => d.deviceId)).toEqual(['a', 'b'])
    expect(media.listening()).toBe(1)
    media.change([device('a', 'A')])
    await flush()
    expect(c.getState().outputDevices.map((d) => d.deviceId)).toEqual(['a'])
    stop()
    expect(media.listening()).toBe(0)
  })

  it('plays on the default while the chosen device is gone, keeps the saved choice, and puts it back when it returns', async () => {
    const media = fakeMedia([device('a', 'A'), device('bt', 'BT')])
    const { c, audio, storage } = setup({ media, outputDeviceKey: 'app.sink' })
    c.watchOutputDevices()
    c.setOutputDevice('bt')
    media.change([device('a', 'A')])
    await flush()
    expect(c.getState().outputDevice).toBe('')
    expect(audio.setSink).toHaveBeenLastCalledWith('')
    expect(storage.data.get('app.sink')).toBe('bt')
    media.change([device('a', 'A'), device('bt', 'BT')])
    await flush()
    expect(c.getState().outputDevice).toBe('bt')
    expect(audio.setSink).toHaveBeenLastCalledWith('bt')
  })

  it('hides the entries whose id the browser blanks, so the default is never listed twice', async () => {
    const media = fakeMedia([device('', ''), device('', ''), device('a', 'A')])
    const { c } = setup({ media })
    c.watchOutputDevices()
    await flush()
    expect(c.getState().outputDevices.map((d) => d.deviceId)).toEqual(['a'])
  })

  it('keeps only the answer of the latest read when reads overlap', async () => {
    const media = fakeMedia([])
    const slow = defer<ReturnType<typeof device>[]>()
    const fast = defer<ReturnType<typeof device>[]>()
    ;(media as { enumerateDevices: unknown }).enumerateDevices = vi
      .fn()
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise)
    const { c } = setup({ media })
    c.watchOutputDevices()
    media.change([])
    fast.resolve([device('new', 'New')])
    await flush()
    slow.resolve([device('old', 'Old')])
    await flush()
    expect(c.getState().outputDevices.map((d) => d.deviceId)).toEqual(['new'])
  })

  it('does not drop the choice while the browser hides device ids', async () => {
    const media = fakeMedia([device('', ''), device('', '')])
    const { c } = setup({ media })
    c.watchOutputDevices()
    c.setOutputDevice('bt')
    await flush()
    expect(c.getState().outputDevice).toBe('bt')
  })

  it('asks for the microphone once, from the person, when no name is readable', async () => {
    const media = fakeMedia([device('a'), device('b')])
    const { c } = setup({ media })
    await c.loadOutputDevices()
    expect(media.getUserMedia).toHaveBeenCalledTimes(1)
    expect(c.getState().outputDevices.map((d) => d.label)).toEqual(['name-a', 'name-b'])
    await c.loadOutputDevices()
    expect(media.getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('asks even when the list is empty or every id is blank - otherwise nothing could ever be chosen', async () => {
    const empty = fakeMedia([])
    await setup({ media: empty }).c.loadOutputDevices()
    expect(empty.getUserMedia).toHaveBeenCalledTimes(1)
    const blank = fakeMedia([device('', 'A')])
    await setup({ media: blank }).c.loadOutputDevices()
    expect(blank.getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('does not ask when the names are already readable', async () => {
    const media = fakeMedia([device('a', 'A')])
    const { c } = setup({ media })
    await c.loadOutputDevices()
    expect(media.getUserMedia).not.toHaveBeenCalled()
  })
})

describe('where the sound comes from', () => {
  it('a youtube song is out of reach: its frame makes the sound, a song with a sound track is not', () => {
    const { c } = setup()
    c.setQueue([tube('t'), song('s'), clip('v')])
    expect(c.soundOnFrame()).toBe(true)
    c.play('s')
    expect(c.soundOnFrame()).toBe(false)
    c.play('v')
    expect(c.soundOnFrame()).toBe(false)
  })
})
