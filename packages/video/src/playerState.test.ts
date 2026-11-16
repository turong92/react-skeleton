import { describe, expect, it } from 'vitest'
import { initialPlayer, reducePlayer } from './playerState'

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
    s = reducePlayer(s, { type: 'audioFailed', kind: 'hls', at: 21 })
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
