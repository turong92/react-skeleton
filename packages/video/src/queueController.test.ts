import { describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from './audioEngine'
import type { QueueItem } from './playQueue'
import { createQueueController } from './queueController'
import type { QueueStorage } from './queueStorage'

function fakeEngine(position = 0) {
  const calls: string[] = []
  let attached = false
  const engine = {
    calls,
    position,
    setElement: () => {},
    element: () => null,
    wake: (url: string) => void calls.push(`wake ${url}`),
    start: vi.fn((r: { url: string; at: number; play: boolean; adopt: boolean }) => {
      attached = true
      calls.push(`start ${r.url}${r.adopt ? ' adopt' : ''}`)
    }),
    stop: vi.fn(() => void calls.push('stop')),
    pause: vi.fn(() => void calls.push('pause')),
    resume: vi.fn(() => void calls.push('resume')),
    restart: vi.fn(() => void calls.push('restart')),
    hasSource: () => attached,
  }
  return Object.assign(engine, { position: () => engine.position as unknown as number })
}

const song = (id: string): QueueItem => ({
  kind: 'media',
  id,
  title: `Song ${id}`,
  source: { src: `/${id}/o.m3u8`, audio: `/${id}/a.m3u8` },
})
const videoOnly = (id: string): QueueItem => ({
  kind: 'media',
  id,
  title: `Clip ${id}`,
  source: { src: `/${id}/o.m3u8` },
})
const youtube = (id: string): QueueItem => ({ kind: 'youtube', id, title: `YT ${id}`, videoId: id })

function setup(items: QueueItem[], opts: { storage?: QueueStorage; position?: number } = {}) {
  const engine = fakeEngine()
  engine.position = (() => opts.position ?? 0) as never
  const c = createQueueController({
    audio: engine as unknown as AudioEngine,
    storage: opts.storage,
    storageKey: 'test.queue',
    random: () => 0,
  })
  c.setQueue(items)
  return { c, engine }
}

const id = (c: ReturnType<typeof setup>['c']) => c.getState().queue.currentId

describe('queue controller - songs', () => {
  it('plays the current song through the one audio element', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play()
    expect(engine.calls).toEqual(['start /a/a.m3u8'])
    expect(c.getState()).toMatchObject({ mode: 'audio', playing: true })
  })

  it('goes on to the next song by itself when one ends - on the same engine, no gesture needed', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play()
    c.audioEnded()
    expect(id(c)).toBe('b')
    expect(engine.calls).toEqual(['start /a/a.m3u8', 'start /b/a.m3u8'])
  })

  it('stops after the last song when repeat is off, and stays on it', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play('b')
    c.audioEnded()
    expect(id(c)).toBe('b')
    expect(engine.calls.at(-1)).toBe('pause')
    expect(c.getState().playing).toBe(false)
  })

  it('wraps with repeat all, and replays the same song with repeat one', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.setRepeat('all')
    c.play('b')
    c.audioEnded()
    expect(id(c)).toBe('a')
    c.setRepeat('one')
    c.audioEnded()
    expect(id(c)).toBe('a')
    expect(engine.calls.at(-1)).toBe('restart')
  })

  it('the next button moves on even with repeat one', () => {
    const { c } = setup([song('a'), song('b')])
    c.setRepeat('one')
    c.play()
    c.next()
    expect(id(c)).toBe('b')
  })

  it('previous restarts after 3 seconds and goes back before that', () => {
    const late = setup([song('a'), song('b')], { position: 10 })
    late.c.play('b')
    late.c.previous()
    expect(id(late.c)).toBe('b')
    expect(late.engine.calls.at(-1)).toBe('restart')
    const early = setup([song('a'), song('b')], { position: 1 })
    early.c.play('b')
    early.c.previous()
    expect(id(early.c)).toBe('a')
  })

  it('pauses and resumes, and starts again when nothing is attached (after a reload)', () => {
    const { c, engine } = setup([song('a')])
    c.toggle()
    expect(engine.calls).toEqual(['start /a/a.m3u8']) // 붙은 것이 없으니 처음부터
    c.toggle()
    expect(engine.calls.at(-1)).toBe('pause')
    c.toggle()
    expect(engine.calls.at(-1)).toBe('resume')
  })
})

describe('queue controller - what cannot play now is skipped', () => {
  it('skips a youtube video when no on-screen player is there', () => {
    const { c } = setup([song('a'), youtube('y'), song('c')])
    c.play()
    c.audioEnded()
    expect(id(c)).toBe('c')
  })

  it('skips a youtube video when the screen is off, even with a player mounted', () => {
    const { c } = setup([song('a'), youtube('y'), song('c')])
    c.setStage(true)
    c.setVisible(false)
    c.play()
    c.audioEnded()
    expect(id(c)).toBe('c')
  })

  it('hands a youtube video to the on-screen player when there is one', () => {
    const { c, engine } = setup([song('a'), youtube('y')])
    c.setStage(true)
    c.play()
    c.audioEnded()
    expect(id(c)).toBe('y')
    expect(c.getState()).toMatchObject({ mode: 'video', playing: true })
    expect(engine.calls.at(-1)).toBe('stop')
  })

  it('moves on from a youtube video when it ends, and when it fails (any error code, or the script)', () => {
    const { c } = setup([youtube('y1'), youtube('y2'), song('c')])
    c.setStage(true)
    c.play()
    c.youtubeEnded()
    expect(id(c)).toBe('y2')
    c.youtubeFailed()
    expect(id(c)).toBe('c')
  })

  it('skips a clip with no sound-only version unless a video player is on screen', () => {
    const closed = setup([song('a'), videoOnly('v'), song('c')])
    closed.c.play()
    closed.c.audioEnded()
    expect(id(closed.c)).toBe('c')
    const open = setup([song('a'), videoOnly('v'), song('c')])
    open.c.setStage(true)
    open.c.play()
    open.c.audioEnded()
    expect(id(open.c)).toBe('v')
    expect(open.c.getState().mode).toBe('video')
  })

  it('stops instead of looping when everything must be skipped', () => {
    const { c, engine } = setup([youtube('y1'), youtube('y2')])
    c.setRepeat('all')
    c.youtubeEnded()
    expect(c.getState().playing).toBe(false)
    expect(engine.start).not.toHaveBeenCalled()
  })

  it('moves on from a song that fails, and stops when every song in a row fails', () => {
    const { c, engine } = setup([song('a'), song('b'), song('c')])
    c.play()
    c.audioFailed()
    expect(id(c)).toBe('b')
    c.audioFailed()
    expect(id(c)).toBe('c')
    c.audioFailed() // 곡 수만큼 연달아 틀렸다
    expect(c.getState().playing).toBe(false)
    expect(engine.calls.at(-1)).toBe('pause')
  })

  it('a song that really plays resets the failure count', () => {
    const { c } = setup([song('a'), song('b'), song('c')])
    c.setRepeat('all')
    c.play()
    c.audioFailed()
    c.audioFailed()
    c.audioPlaying() // 둘 연달아 틀렸지만 세 번째가 틀어졌다
    c.audioFailed()
    expect(id(c)).toBe('a')
    expect(c.getState().playing).toBe(true)
  })
})

describe('queue controller - borrowed by the video player', () => {
  it('when the video ends the next song continues as sound', () => {
    const { c, engine } = setup([videoOnly('v'), song('b')])
    c.setStage(true)
    c.play()
    expect(c.getState().mode).toBe('video')
    c.videoEnded()
    expect(id(c)).toBe('b')
    expect(c.getState().mode).toBe('audio')
    expect(engine.calls.at(-1)).toBe('start /b/a.m3u8')
  })

  it('the player hands the sound over on the same element (adopt) and the queue knows it is playing', () => {
    const { c, engine } = setup([song('a')])
    c.host.start({ url: '/a/a.m3u8', at: 12, play: true, adopt: true })
    expect(engine.calls).toEqual(['start /a/a.m3u8 adopt'])
    expect(c.getState()).toMatchObject({ mode: 'audio', playing: true })
  })

  it('going back to video stops the sound and the queue leaves audio mode', () => {
    const { c, engine } = setup([song('a')])
    c.host.start({ url: '/a/a.m3u8', at: 0, play: true, adopt: false })
    c.host.stop()
    expect(engine.calls.at(-1)).toBe('stop')
    expect(c.getState()).toMatchObject({ mode: 'video', playing: false })
  })

  it("wakes the shared element on the player's behalf", () => {
    const { c, engine } = setup([song('a')])
    c.host.wake('/a/a.m3u8')
    expect(engine.calls).toEqual(['wake /a/a.m3u8'])
  })

  it('follows the video player playing and pausing only in video mode', () => {
    const { c } = setup([videoOnly('v')])
    c.setStage(true)
    c.play()
    c.setVideoPlaying(true)
    expect(c.getState().playing).toBe(true)
  })
})

describe('queue controller - editing the list while playing', () => {
  it('starts the following song when the playing one is removed', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play()
    c.remove('a')
    expect(id(c)).toBe('b')
    expect(engine.calls.at(-1)).toBe('start /b/a.m3u8')
  })

  it('stops when the last song is removed', () => {
    const { c, engine } = setup([song('a')])
    c.play()
    c.remove('a')
    expect(id(c)).toBeNull()
    expect(engine.calls.at(-1)).toBe('stop')
  })

  it('removing a song that is not playing leaves playback alone', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play()
    c.remove('b')
    expect(engine.calls).toEqual(['start /a/a.m3u8'])
  })

  it('adds songs to play next or at the end', () => {
    const { c } = setup([song('a'), song('b')])
    c.add(song('x'), 'next')
    c.add(song('y'))
    expect(c.getState().queue.order).toEqual(['a', 'x', 'b', 'y'])
  })
})

describe('queue controller - saved on this device', () => {
  function memory(): QueueStorage & { data: Record<string, string> } {
    const data: Record<string, string> = {}
    return {
      data,
      getItem: (k) => data[k] ?? null,
      setItem: (k, v) => void (data[k] = v),
      removeItem: (k) => void delete data[k],
    }
  }

  it('saves under the key the app chose, and restores after a reload without playing', () => {
    const storage = memory()
    const first = setup([song('a'), song('b')], { storage })
    first.c.setRepeat('all')
    first.c.play('b')
    expect(Object.keys(storage.data)).toEqual(['test.queue'])

    const second = createQueueController({
      audio: fakeEngine() as unknown as AudioEngine,
      storage,
      storageKey: 'test.queue',
    })
    second.restore()
    expect(second.getState().queue).toMatchObject({ currentId: 'b', repeat: 'all' })
    expect(second.getState().playing).toBe(false)
  })

  it('does not overwrite a list the app already set with the saved one', () => {
    const storage = memory()
    setup([song('old')], { storage })
    const second = setup([song('new')], { storage })
    second.c.restore()
    expect(second.c.getState().queue.order).toEqual(['new'])
  })
})

describe('queue controller - subscribing', () => {
  it('tells listeners about each change and keeps the snapshot the same between changes', () => {
    const { c } = setup([song('a')])
    const listener = vi.fn()
    const off = c.subscribe(listener)
    const before = c.getState()
    expect(c.getState()).toBe(before)
    c.play()
    expect(listener).toHaveBeenCalled()
    expect(c.getState()).not.toBe(before)
    off()
    listener.mockClear()
    c.pause()
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('queue controller - listening to the shared <audio>', () => {
  function element() {
    const handlers = new Map<string, () => void>()
    return {
      ended: false,
      addEventListener: (type: string, fn: () => void) => void handlers.set(type, fn),
      removeEventListener: (type: string) => void handlers.delete(type),
      fire: (type: string) => handlers.get(type)?.(),
      handlers,
    }
  }

  it('moves on when the element reports the end or an error, and follows playing / pausing', () => {
    const { c } = setup([song('a'), song('b'), song('c')])
    const el = element()
    c.attachElement(el as never)
    c.play()
    el.fire('playing')
    expect(c.getState().playing).toBe(true)
    el.fire('pause')
    expect(c.getState().playing).toBe(false)
    el.fire('ended')
    expect(id(c)).toBe('b')
    el.fire('error')
    expect(id(c)).toBe('c')
  })

  it('does not take the pause that comes just before the end for a pause', () => {
    const { c } = setup([song('a'), song('b')])
    const el = element()
    c.attachElement(el as never)
    c.play()
    el.ended = true
    el.fire('pause')
    expect(c.getState().playing).toBe(true)
  })

  it('stops listening when the element goes away', () => {
    const { c } = setup([song('a')])
    const el = element()
    c.attachElement(el as never)
    c.attachElement(null)
    expect(el.handlers.size).toBe(0)
  })
})
