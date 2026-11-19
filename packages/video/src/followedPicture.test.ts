import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachFollowedPicture, pictureStep } from './followedPicture'
import { initialPlayer, reducePlayer } from './playerState'

afterEach(() => vi.useRealTimers())

describe('pictureStep - what a song on the queue does with its video when the queue mode changes', () => {
  it('attaches the muted video when the queue is in video mode', () => {
    expect(pictureStep({ pictureWanted: true, phase: 'idle', mode: 'video' })).toBe('attach')
    // 실패 뒤에도 영상 모드로 다시 들어오면 다시 붙여 본다
    expect(pictureStep({ pictureWanted: true, phase: 'failed', mode: 'video' })).toBe('attach')
  })

  it('detaches a playing video when the queue goes to audio mode, and leaves anything else alone', () => {
    expect(pictureStep({ pictureWanted: false, phase: 'playing', mode: 'video' })).toBe('detach')
    expect(pictureStep({ pictureWanted: false, phase: 'idle', mode: 'video' })).toBeNull()
    expect(pictureStep({ pictureWanted: false, phase: 'failed', mode: 'video' })).toBeNull()
    expect(pictureStep({ pictureWanted: false, phase: 'playing', mode: 'audio' })).toBeNull()
  })

  it('a failed picture can be attached again (retry) and the next attach starts clean', () => {
    const failed = reducePlayer(
      reducePlayer(initialPlayer, { type: 'press', kind: 'hls', mode: 'video' }),
      { type: 'giveUp' },
    )
    expect(failed.phase).toBe('failed')
    const again = reducePlayer(failed, { type: 'press', kind: 'hls', mode: 'video' })
    expect(again).toMatchObject({ phase: 'playing', mode: 'video', session: failed.session + 1 })
  })
})

function fakeMedia() {
  const listeners = new Map<string, Set<() => void>>()
  return {
    src: '',
    muted: false,
    currentTime: 0,
    duration: 100,
    paused: true,
    seeking: false,
    readyState: 4,
    playbackRate: 1,
    play: vi.fn(function (this: { paused: boolean }) {
      this.paused = false
      return Promise.resolve()
    }),
    pause: vi.fn(function (this: { paused: boolean }) {
      this.paused = true
    }),
    load: vi.fn(),
    removeAttribute: vi.fn(function (this: { src: string }, name: string) {
      if (name === 'src') this.src = ''
    }),
    addEventListener: (name: string, fn: () => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name)!.add(fn)
    },
    removeEventListener: (name: string, fn: () => void) => listeners.get(name)?.delete(fn),
    emit: (name: string) => listeners.get(name)?.forEach((fn) => fn()),
    count: (name: string) => listeners.get(name)?.size ?? 0,
  }
}

function attach(over: { playing?: boolean; at?: number } = {}) {
  vi.useFakeTimers()
  const media = fakeMedia()
  const sound = { at: over.at ?? 30, playing: over.playing ?? true }
  const handlers = { onFatal: vi.fn(), onSynced: vi.fn(), onBlocked: vi.fn() }
  const detach = attachFollowedPicture(media as never, 'https://cdn.test/v.m3u8', 'native', {
    loadHls: () => Promise.reject(new Error('unused')),
    sound: { position: () => sound.at, playing: () => sound.playing },
    ...handlers,
  })
  return { media, sound, detach, ...handlers }
}

describe('attachFollowedPicture', () => {
  it('attaches the video muted, starting a second ahead of the sound while it plays', () => {
    const { media } = attach({ at: 30 })
    expect(media.muted).toBe(true)
    expect(media.src).toBe('https://cdn.test/v.m3u8')
    media.emit('loadedmetadata')
    expect(media.currentTime).toBe(31)
  })

  it('takes the video away on detach - stops, drops the file, tells the poster to cover and the block to clear', () => {
    const { media, detach, onSynced, onBlocked } = attach()
    detach()
    expect(media.pause).toHaveBeenCalled()
    expect(media.removeAttribute).toHaveBeenCalledWith('src')
    expect(media.src).toBe('')
    expect(media.load).toHaveBeenCalled()
    expect(onSynced).toHaveBeenLastCalledWith(false)
    expect(onBlocked).toHaveBeenLastCalledWith(null)
    expect(media.count('error')).toBe(0)
  })

  it('reports a failed picture (media error) without touching anything else', () => {
    const { media, onFatal } = attach()
    media.emit('error')
    expect(onFatal).toHaveBeenCalledTimes(1)
  })
})
