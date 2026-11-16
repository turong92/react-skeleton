import { describe, expect, it } from 'vitest'
import { playbackOf, playerSourceOf } from './playerSource'
import { fakeGrant } from './test/grant'

describe('playerSourceOf', () => {
  it('keeps only the addresses of a server grant, so the player can take either', () => {
    const grant = fakeGrant({ audio: 'https://cdn.test/v/a/a-1/index.m3u8' })
    expect(playerSourceOf(grant)).toEqual({
      src: grant.src,
      audio: 'https://cdn.test/v/a/a-1/index.m3u8',
      poster: grant.poster,
      compat: grant.compat,
      hls: grant.hls,
      codec: grant.codec,
    })
  })

  it('leaves out what the grant does not have', () => {
    const grant = fakeGrant({ compat: undefined, hls: undefined })
    expect(playerSourceOf(grant)).toEqual({
      src: grant.src,
      poster: grant.poster,
      codec: grant.codec,
    })
  })
})

describe('playbackOf', () => {
  it('lets an app with no server grant play same-origin addresses (nothing signed, nothing expiring)', () => {
    const playback = playbackOf({ src: '/media/a/index.m3u8', audio: '/media/a/audio.m3u8' })
    expect(playback).toMatchObject({
      src: '/media/a/index.m3u8',
      audio: '/media/a/audio.m3u8',
      poster: '',
      codec: '',
      big: false,
      durationMs: 0,
    })
    expect(playback.expiresAt).toBeUndefined()
    expect(playback.hls).toBeUndefined()
  })

  it('carries poster, compat and master addresses through', () => {
    expect(
      playbackOf({ src: '/o.m3u8', poster: '/p.jpg', compat: '/c.m3u8', hls: '/m.m3u8' }),
    ).toMatchObject({ src: '/o.m3u8', poster: '/p.jpg', compat: '/c.m3u8', hls: '/m.m3u8' })
  })

  it('round-trips a grant through a source without losing the addresses', () => {
    const grant = fakeGrant({ audio: 'https://cdn.test/a.m3u8' })
    expect(playbackOf(playerSourceOf(grant))).toMatchObject({
      src: grant.src,
      audio: grant.audio,
      poster: grant.poster,
      compat: grant.compat,
      hls: grant.hls,
    })
  })
})

describe('PlayerSource codec', () => {
  it('carries the codec string of the original tier into the player, and back out of a grant', () => {
    expect(playbackOf({ src: '/o.m3u8', codec: 'avc1.640028,mp4a.40.2' }).codec).toBe(
      'avc1.640028,mp4a.40.2',
    )
    expect(playerSourceOf(fakeGrant({ codec: 'avc1.640028' })).codec).toBe('avc1.640028')
  })

  it('leaves the codec empty (unknown) when nothing is given', () => {
    expect(playbackOf({ src: '/o.m3u8' }).codec).toBe('')
    expect(playerSourceOf(fakeGrant({ codec: '' })).codec).toBeUndefined()
  })
})
