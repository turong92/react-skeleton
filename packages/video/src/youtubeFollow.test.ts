import { describe, expect, it, vi } from 'vitest'
import { youtubeAsVideo, youtubeRate } from './youtubeFollow'

const STATES = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 }

function fakePlayer(
  over: { state?: number; time?: number; duration?: number; rate?: number } = {},
) {
  let rate = over.rate ?? 1
  return {
    getCurrentTime: () => over.time ?? 10,
    getDuration: () => over.duration ?? 200,
    seekTo: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    getPlayerState: () => over.state ?? STATES.PLAYING,
    getPlaybackRate: () => rate,
    setPlaybackRate: vi.fn((r: number) => {
      rate = r
    }),
  }
}

describe('youtubeRate', () => {
  it('rounds the follow speed to the steps youtube supports - small nudges stay at 1', () => {
    expect([1.25, 1.15, 1.1, 1.05, 1, 0.95, 0.9, 0.85, 0.75].map(youtubeRate)).toEqual([
      1.25, 1.25, 1, 1, 1, 1, 1, 0.75, 0.75,
    ])
  })
})

describe('youtubeAsVideo', () => {
  it('reads like a <video>: time, length, paused, buffering as seeking', () => {
    const v = youtubeAsVideo(fakePlayer({ state: STATES.PLAYING }), STATES)
    expect([v.currentTime, v.duration, v.paused, v.seeking, v.readyState]).toEqual([
      10,
      200,
      false,
      false,
      4,
    ])
    const b = youtubeAsVideo(fakePlayer({ state: STATES.BUFFERING, duration: 0 }), STATES)
    expect([b.paused, b.seeking, Number.isNaN(b.duration), b.readyState]).toEqual([
      false,
      true,
      true,
      1,
    ])
    expect(youtubeAsVideo(fakePlayer({ state: STATES.PAUSED }), STATES).paused).toBe(true)
  })

  it('moves with seekTo and only changes speed when the youtube step changes', () => {
    const p = fakePlayer()
    const v = youtubeAsVideo(p, STATES)
    v.currentTime = 42
    expect(p.seekTo).toHaveBeenCalledWith(42, true)
    v.playbackRate = 1.05
    expect(p.setPlaybackRate).not.toHaveBeenCalled()
    v.playbackRate = 1.2
    expect(p.setPlaybackRate).toHaveBeenCalledWith(1.25)
    v.playbackRate = 1.25
    expect(p.setPlaybackRate).toHaveBeenCalledTimes(1)
  })

  it('play and pause drive the player', async () => {
    const p = fakePlayer()
    const v = youtubeAsVideo(p, STATES)
    await v.play()
    v.pause()
    expect(p.playVideo).toHaveBeenCalledTimes(1)
    expect(p.pauseVideo).toHaveBeenCalledTimes(1)
  })
})
