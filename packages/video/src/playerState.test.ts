import { describe, expect, it } from 'vitest'
import {
  followPlayback,
  followPreference,
  initialPlayer,
  momentOf,
  reducePlayer,
} from './playerState'

describe('reducePlayer', () => {
  it('starts idle and plays the first step from the beginning when pressed', () => {
    const s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    expect(s).toMatchObject({
      phase: 'playing',
      kind: 'hls',
      tried: ['hls'],
      at: 0,
      refreshed: false,
    })
    expect(s.session).toBe(initialPlayer.session + 1)
  })

  it('falls through to the next step from the same moment, and remembers what was tried', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    s = reducePlayer(s, { type: 'next', kind: 'orig', at: 12 })
    expect(s).toMatchObject({ phase: 'playing', kind: 'orig', tried: ['hls', 'orig'], at: 12 })
  })

  it('reloads the same step at the same moment after a fresh grant, only once per failure run', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    const before = s.session
    s = reducePlayer(s, { type: 'refresh', at: 30 })
    expect(s).toMatchObject({ kind: 'hls', tried: ['hls'], at: 30, refreshed: true })
    expect(s.session).toBe(before + 1)
  })

  it('keeps the moment when the viewer picks another quality, and forgets earlier failures', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    s = reducePlayer(s, { type: 'next', kind: 'orig', at: 5 })
    s = reducePlayer(s, { type: 'choose', pick: 'compat', kind: 'compat', at: 20 })
    expect(s).toMatchObject({
      pick: 'compat',
      kind: 'compat',
      tried: ['compat'],
      at: 20,
      refreshed: false,
    })
  })

  it('starts in video mode, and a press can start in audio mode (initialMode)', () => {
    expect(initialPlayer.mode).toBe('video')
    const s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls', mode: 'audio' })
    expect(s).toMatchObject({ phase: 'playing', mode: 'audio', at: 0, play: true, adopt: false })
  })

  it('remembers the mode picked before the first press without starting anything', () => {
    const s = reducePlayer(initialPlayer, { type: 'mode', mode: 'audio', at: 0, play: false })
    expect(s).toMatchObject({ phase: 'idle', mode: 'audio' })
    expect(s.session).toBe(initialPlayer.session)
  })

  it('switches mode while playing from the same moment, keeping whether it was playing', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    s = reducePlayer(s, { type: 'mode', mode: 'audio', at: 33, play: false })
    expect(s).toMatchObject({ phase: 'playing', mode: 'audio', at: 33, play: false, notice: false })
    expect(s.session).toBe(initialPlayer.session + 2)
    s = reducePlayer(s, { type: 'mode', mode: 'video', kind: 'orig', at: 40, play: true })
    expect(s).toMatchObject({ mode: 'video', kind: 'orig', tried: ['orig'], at: 40, play: true })
  })

  it('hands over to audio when the screen goes off, and says the audio is already playing when native', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    s = reducePlayer(s, { type: 'handoff', at: 12, adopt: true })
    expect(s).toMatchObject({ mode: 'audio', at: 12, play: true, adopt: true })
    s = reducePlayer(s, { type: 'refresh', at: 20 })
    expect(s.adopt).toBe(false) // 다시 붙일 때는 새로 붙인다
  })

  it('falls back to video with a notice, from the same moment, when the sound-only version fails', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls', mode: 'audio' })
    s = reducePlayer(s, { type: 'audioFailed', kind: 'hls', at: 21, play: true })
    expect(s).toMatchObject({
      phase: 'playing',
      mode: 'video',
      kind: 'hls',
      tried: ['hls'],
      at: 21,
      play: true,
      notice: true,
    })
    s = reducePlayer(s, { type: 'mode', mode: 'audio', at: 25, play: true })
    expect(s.notice).toBe(false)
  })

  it('shows the failure when every step failed, and pressing again starts over', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    s = reducePlayer(s, { type: 'giveUp' })
    expect(s).toMatchObject({ phase: 'failed', kind: null, tried: [] })
    s = reducePlayer(s, { type: 'press', kind: 'hls' })
    expect(s.phase).toBe('playing')
  })
})

describe('reducePlayer - paused hand-over and failure', () => {
  it('marks a hand-over that could not play as paused without leaving audio mode', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    s = reducePlayer(s, { type: 'handoff', at: 12, adopt: true })
    const before = s.session
    s = reducePlayer(s, { type: 'paused' })
    expect(s).toMatchObject({ mode: 'audio', play: false })
    expect(s.session).toBe(before) // 다시 붙이지 않는다
  })

  it('goes back to video paused when it was paused, from the quality that was chosen', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls', mode: 'audio' })
    s = reducePlayer(s, { type: 'audioFailed', kind: 'compat', at: 9, play: false })
    expect(s).toMatchObject({ mode: 'video', kind: 'compat', at: 9, play: false, notice: true })
  })
})

describe('momentOf', () => {
  it('uses the element time once it has loaded', () => {
    expect(momentOf({ readyState: 4, currentTime: 31 }, 5)).toBe(31)
  })

  it('keeps the known moment when the element never loaded (preload none reports 0)', () => {
    expect(momentOf({ readyState: 0, currentTime: 0 }, 42)).toBe(42)
    expect(momentOf(null, 42)).toBe(42)
  })
})

describe("reducePlayer - joining the queue's sound", () => {
  it("moves a mounted player into audio mode at the queue's moment, adopting what plays", () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    const before = s.session
    s = reducePlayer(s, { type: 'join', at: 61, play: true })
    expect(s).toMatchObject({ phase: 'playing', mode: 'audio', at: 61, play: true, adopt: true })
    expect(s.session).toBe(before + 1)
  })

  it('joins a player that was never pressed, and keeps a paused queue paused', () => {
    const s = reducePlayer(initialPlayer, { type: 'join', at: 5, play: false })
    expect(s).toMatchObject({ phase: 'playing', mode: 'audio', at: 5, play: false, adopt: true })
  })
})

describe('followPreference', () => {
  it('moves the player to the preference when it is in the other mode - even if the preference value did not change (the signal asks again)', () => {
    expect(followPreference('audio', 'video')).toBe('audio')
    expect(followPreference('video', 'audio')).toBe('video')
  })

  it('does nothing when it already is in that mode or there is no preference', () => {
    expect(followPreference('video', 'video')).toBeNull()
    expect(followPreference(undefined, 'video')).toBeNull()
  })
})

describe('followPlayback', () => {
  it('pauses a playing video the queue says is paused, and plays a paused one the queue says plays', () => {
    expect(followPlayback(false, false)).toBe('pause')
    expect(followPlayback(true, true)).toBe('play')
  })

  it('does nothing when they already agree, or when the queue says nothing', () => {
    expect(followPlayback(true, false)).toBeNull()
    expect(followPlayback(false, true)).toBeNull()
    expect(followPlayback(true, undefined)).toBeNull()
  })
})
