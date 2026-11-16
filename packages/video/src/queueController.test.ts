import { describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from './audioEngine'
import type { QueueItem } from './playQueue'
import { createQueueController } from './queueController'
import type { QueueStorage } from './queueStorage'

function fakeEngine(opts: { position?: number } = {}) {
  const calls: string[] = []
  let loaded: string | null = null
  return {
    calls,
    setElement: () => {},
    element: () => null,
    wake: vi.fn((url: string) => void calls.push(`wake ${url}`)),
    start: vi.fn((r: { url: string; adopt: boolean; itemId?: string }) => {
      loaded = r.itemId ?? null
      calls.push(`start ${r.url}${r.adopt ? ' adopt' : ''}`)
    }),
    stop: vi.fn(() => {
      loaded = null
      calls.push('stop')
    }),
    pause: vi.fn(() => void calls.push('pause')),
    resume: vi.fn(() => void calls.push('resume')),
    restart: vi.fn(() => void calls.push('restart')),
    position: () => opts.position ?? 0,
    loadedItem: () => loaded,
  }
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
  const engine = fakeEngine({ position: opts.position })
  const c = createQueueController({
    audio: engine as unknown as AudioEngine,
    storage: opts.storage,
    storageKey: 'test.queue',
    random: () => 0,
  })
  c.setQueue(items)
  return { c, engine }
}

type Setup = ReturnType<typeof setup>
const id = (c: Setup['c']) => c.getState().queue.currentId

describe('queue controller - songs', () => {
  it('plays the current song through the one audio element', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play()
    expect(engine.calls).toEqual(['wake /a/a.m3u8', 'start /a/a.m3u8'])
    expect(c.getState()).toMatchObject({ mode: 'audio', playing: true })
  })

  it('goes on to the next song by itself when one ends - on the same engine, no gesture needed', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play()
    c.audioEnded()
    expect(id(c)).toBe('b')
    expect(engine.calls.slice(-1)).toEqual(['start /b/a.m3u8'])
  })

  it('stops after the last song when repeat is off, and stays on it', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play('b')
    c.audioEnded()
    expect(id(c)).toBe('b')
    expect(engine.calls.at(-1)).toBe('stop')
    expect(c.getState().playing).toBe(false)
  })

  it('a late "playing" event after the stop does not switch playing back on', () => {
    const { c } = setup([song('a')])
    c.play()
    c.audioEnded()
    c.audioPlaying()
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

  it('pauses and resumes the song that is on the element', () => {
    const { c, engine } = setup([song('a')])
    c.play()
    c.toggle()
    expect(engine.calls.at(-1)).toBe('pause')
    c.toggle()
    expect(engine.calls.at(-1)).toBe('resume')
  })
})

describe('queue controller - resume only the song that is on the element', () => {
  it('starts again after a reload, when nothing is on the element', () => {
    const { c, engine } = setup([song('a')])
    c.toggle()
    expect(engine.calls.at(-1)).toBe('start /a/a.m3u8')
  })

  it('does not resume the song that was removed - it starts the one that took its place', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play()
    c.pause()
    c.remove('a')
    c.resume()
    expect(id(c)).toBe('b')
    expect(engine.calls.at(-1)).toBe('start /b/a.m3u8')
  })

  it('does not restart a song that is no longer on the element - it starts it', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play('a')
    c.host.stop()
    c.previous()
    expect(engine.calls.at(-1)).toBe('start /a/a.m3u8')
  })
})

describe('queue controller - the element is woken in the gesture', () => {
  it('wakes the element with the first sound-only address when the queue starts with a youtube video', () => {
    const { c, engine } = setup([youtube('y'), song('a')])
    c.play()
    expect(engine.wake).toHaveBeenCalledWith('/a/a.m3u8')
    expect(c.getState().mode).toBe('video')
  })

  it('wakes with a clip that has no sound-only version too, and only once', () => {
    const { c, engine } = setup([videoOnly('v'), song('a')])
    c.play()
    c.next()
    expect(engine.wake).toHaveBeenCalledTimes(1)
  })

  it('wakes from the other gesture entry points as well (start, resume, next, previous)', () => {
    for (const act of [
      (c: Setup['c']) => c.resume(),
      (c: Setup['c']) => c.next(),
      (c: Setup['c']) => c.previous(),
    ]) {
      const { c, engine } = setup([youtube('y'), song('a')])
      act(c)
      expect(engine.wake).toHaveBeenCalledTimes(1)
    }
    const { c, engine } = setup([])
    c.setQueue([youtube('y'), song('a')], { play: true })
    expect(engine.wake).toHaveBeenCalledTimes(1)
  })

  it('does not wake a second time once a song is on the element', () => {
    const { c, engine } = setup([song('a'), song('b')])
    c.play()
    c.next()
    expect(engine.wake).toHaveBeenCalledTimes(1)
  })

  it('says it is not playing when the phone refused the play()', () => {
    const { c } = setup([song('a')])
    c.play()
    c.audioRejected()
    expect(c.getState().playing).toBe(false)
  })
})

describe('queue controller - the video / song choice stays across songs', () => {
  it('with the song preference, youtube and clips are skipped even with a player on screen', () => {
    const { c } = setup([song('a'), youtube('y'), videoOnly('v'), song('c')])
    c.setStage(true)
    c.play()
    c.audioEnded()
    expect(id(c)).toBe('c')
  })

  it('choosing a video-only item makes the preference video, so the next ones follow as video', () => {
    const { c, engine } = setup([youtube('y'), song('a')])
    c.setStage(true)
    c.play()
    expect(c.getState().preferred).toBe('video')
    c.youtubeEnded()
    expect(id(c)).toBe('a')
    expect(c.getState()).toMatchObject({ mode: 'video', playing: true }) // 영상 선호 - 다음 곡도 영상으로
    expect(engine.calls.at(-1)).toBe('stop')
  })

  it('with the video preference and the screen off, the next song plays as sound but the preference stays', () => {
    const { c, engine } = setup([youtube('y'), song('a')])
    c.setStage(true)
    c.play()
    c.setVisible(false)
    c.youtubeEnded()
    expect(engine.calls.at(-1)).toBe('start /a/a.m3u8')
    expect(c.getState()).toMatchObject({ mode: 'audio', preferred: 'video' })
  })

  it('the player choosing sound sets the preference to sound, and choosing video to video', () => {
    const { c } = setup([song('a')])
    c.host.stop()
    expect(c.getState().preferred).toBe('video')
    c.host.start({ url: '/a/a.m3u8', at: 0, play: true, adopt: false })
    expect(c.getState().preferred).toBe('audio')
  })

  it('an automatic switch when the screen goes off does not change the preference', () => {
    const { c } = setup([song('a')])
    c.host.stop()
    c.setVisible(false)
    c.host.start({ url: '/a/a.m3u8', at: 12, play: true, adopt: true })
    expect(c.getState()).toMatchObject({ mode: 'audio', preferred: 'video' })
  })

  it('the app can set the first preference', () => {
    const { c } = setup([song('a')])
    c.setPreferred('video')
    expect(c.getState().preferred).toBe('video')
  })
})

describe('queue controller - what cannot play now is skipped', () => {
  it('skips a youtube video when there is no on-screen player or the screen is off', () => {
    const { c } = setup([song('a'), youtube('y'), song('c')])
    c.setPreferred('video')
    c.play()
    c.audioEnded()
    expect(id(c)).toBe('c')
    c.setStage(true)
    c.setVisible(false)
    c.play('a')
    c.audioEnded()
    expect(id(c)).toBe('c')
  })

  it('hands a clip with no sound-only version to the on-screen player and signals it to start', () => {
    const { c } = setup([song('a'), videoOnly('v')])
    c.setPreferred('video')
    c.setStage(true)
    c.play()
    const before = c.getState().stageStart
    c.audioEnded()
    expect(id(c)).toBe('v')
    expect(c.getState()).toMatchObject({ mode: 'video', playing: true })
    expect(c.getState().stageStart).toBe(before + 1)
  })

  it('a clip with repeat one is started again by the same signal', () => {
    const { c } = setup([videoOnly('v')])
    c.setStage(true)
    c.setRepeat('one')
    c.play()
    const before = c.getState().stageStart
    c.videoEnded()
    expect(c.getState().stageStart).toBe(before + 1)
  })

  it('moves on when the on-screen video fails, like any other failure', () => {
    const { c } = setup([videoOnly('v'), song('a')])
    c.setStage(true)
    c.play()
    c.videoFailed()
    expect(id(c)).toBe('a')
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
    c.audioFailed()
    expect(c.getState().playing).toBe(false)
    expect(engine.calls.at(-1)).toBe('stop')
  })

  it('a song that really plays resets the failure count', () => {
    const { c } = setup([song('a'), song('b'), song('c')])
    c.setRepeat('all')
    c.play()
    c.audioFailed()
    c.audioFailed()
    c.audioPlaying()
    c.audioFailed()
    expect(id(c)).toBe('a')
    expect(c.getState().playing).toBe(true)
  })
})

describe('queue controller - borrowed by the video player', () => {
  it('when the video ends the next song continues as sound with the song preference', () => {
    const { c, engine } = setup([videoOnly('v'), song('b')])
    c.setStage(true)
    c.play()
    c.host.start({ url: '/x', at: 0, play: true, adopt: false }) // 재생기가 소리로 갔다
    c.videoEnded()
    expect(id(c)).toBe('b')
    expect(c.getState().mode).toBe('audio')
    expect(engine.calls.at(-1)).toBe('start /b/a.m3u8')
  })

  it('the player hands the sound over on the same element (adopt) and the queue knows which song it is', () => {
    const { c, engine } = setup([song('a')])
    c.host.start({ url: '/a/a.m3u8', at: 12, play: true, adopt: true })
    expect(engine.calls).toEqual(['start /a/a.m3u8 adopt'])
    expect(engine.loadedItem()).toBe('a')
    expect(c.getState()).toMatchObject({ mode: 'audio', playing: true })
  })

  it('tells a freshly mounted player that the queue is already playing this song as sound', () => {
    const { c } = setup([song('a')])
    c.play()
    expect(c.host.status()).toEqual({ playing: true, at: 0 })
    c.pause()
    expect(c.host.status()).toEqual({ playing: false, at: 0 })
  })

  it('says nothing when the queue is not playing the current song as sound', () => {
    const { c } = setup([song('a'), song('b')])
    expect(c.host.status()).toBeNull()
    c.play('a')
    c.next() // 곡 b 가 요소에 붙었다
    c.play('a')
    expect(c.host.status()).toMatchObject({ playing: true })
    c.host.stop()
    expect(c.host.status()).toBeNull()
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
    c.setVideoPlaying(false)
    expect(c.getState().playing).toBe(false)
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
    expect(engine.calls).toEqual(['wake /a/a.m3u8', 'start /a/a.m3u8'])
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
