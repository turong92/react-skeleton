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

  it('shows the failure when every step failed, and pressing again starts over', () => {
    let s = reducePlayer(initialPlayer, { type: 'press', kind: 'hls' })
    s = reducePlayer(s, { type: 'giveUp' })
    expect(s).toMatchObject({ phase: 'failed', kind: null, tried: [] })
    s = reducePlayer(s, { type: 'press', kind: 'hls' })
    expect(s.phase).toBe('playing')
  })
})
