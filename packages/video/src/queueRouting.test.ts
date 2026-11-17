import { describe, expect, it } from 'vitest'
import type { QueueItem } from './playQueue'
import { audioUrlOf, canPlayNow, firstAudioUrl, hasAudio, routeOf } from './queueRouting'

const song: QueueItem = {
  kind: 'media',
  id: 's',
  title: 'S',
  source: { src: '/o.m3u8', audio: '/a.m3u8' },
}
const clip: QueueItem = { kind: 'media', id: 'c', title: 'C', source: { src: '/o.m3u8' } }
const yt: QueueItem = { kind: 'youtube', id: 'y', title: 'Y', videoId: 'abc' }

describe('canPlayNow', () => {
  it('with the song preference, only songs that have a sound-only version play - even with a player on screen', () => {
    const ctx = { preferred: 'audio', stageOpen: true } as const
    expect(canPlayNow(song, ctx)).toBe(true)
    expect(canPlayNow(clip, ctx)).toBe(false)
    expect(canPlayNow(yt, ctx)).toBe(false)
  })

  it('with the video preference, everything plays while a player is on screen', () => {
    const ctx = { preferred: 'video', stageOpen: true } as const
    expect([song, clip, yt].map((i) => canPlayNow(i, ctx))).toEqual([true, true, true])
  })

  it('with the video preference but the screen off, only songs play (as sound)', () => {
    const ctx = { preferred: 'video', stageOpen: false } as const
    expect([song, clip, yt].map((i) => canPlayNow(i, ctx))).toEqual([true, false, false])
  })
})

describe('routeOf', () => {
  it('plays a song as sound with the song preference', () => {
    expect(routeOf(song, { preferred: 'audio', stageOpen: true })).toBe('audio')
  })

  it('keeps the next song as video with the video preference while the screen is on', () => {
    expect(routeOf(song, { preferred: 'video', stageOpen: true })).toBe('video')
  })

  it('turns a song into sound only when the screen went off, and keeps the preference elsewhere', () => {
    expect(routeOf(song, { preferred: 'video', stageOpen: false })).toBe('audio')
  })

  it('always gives a youtube video or a clip to the on-screen player', () => {
    expect(routeOf(yt, { preferred: 'audio', stageOpen: false })).toBe('video')
    expect(routeOf(clip, { preferred: 'audio', stageOpen: true })).toBe('video')
  })
})

describe('firstAudioUrl', () => {
  const queue = (items: QueueItem[]) => ({
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    original: items.map((i) => i.id),
    order: items.map((i) => i.id),
    currentId: items[0]?.id ?? null,
    repeat: 'off' as const,
    shuffle: false,
  })

  it('finds the first sound-only address past a youtube video and a silent clip', () => {
    expect(firstAudioUrl(queue([yt, clip, song]))).toBe('/a.m3u8')
  })

  it('has nothing to wake with when no item has a sound-only version', () => {
    expect(firstAudioUrl(queue([yt, clip]))).toBeNull()
  })
})

describe('youtube with a sound file', () => {
  const ytSound: QueueItem = {
    kind: 'youtube',
    id: 'ys',
    title: 'YS',
    videoId: 'abc',
    audio: '/media/ys/audio.m4a',
  }
  it('counts as having sound - plays as a song, and from the queue <audio> unless the video is on screen', () => {
    expect(audioUrlOf(ytSound)).toBe('/media/ys/audio.m4a')
    expect(hasAudio(ytSound)).toBe(true)
    expect(canPlayNow(ytSound, { preferred: 'audio', stageOpen: false })).toBe(true)
    expect(routeOf(ytSound, { preferred: 'audio', stageOpen: true })).toBe('audio')
    expect(routeOf(ytSound, { preferred: 'video', stageOpen: false })).toBe('audio')
    expect(routeOf(ytSound, { preferred: 'video', stageOpen: true })).toBe('video')
  })
  it('a youtube item without a sound file stays video-only', () => {
    expect(hasAudio(yt)).toBe(false)
    expect(routeOf(yt, { preferred: 'audio', stageOpen: true })).toBe('video')
  })
})
