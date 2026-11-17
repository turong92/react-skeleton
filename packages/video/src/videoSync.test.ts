import { afterEach, describe, expect, it, vi } from 'vitest'
import { followSound, planSync, type SyncInput } from './videoSync'

const input = (over: Partial<SyncInput> = {}): SyncInput => ({
  video: 10,
  sound: 10,
  soundPlaying: true,
  duration: 200,
  sinceSeekMs: 10_000,
  ...over,
})

describe('planSync', () => {
  it('leaves a video that is on the sound alone: normal speed, playing', () => {
    expect(planSync(input())).toEqual({ seekTo: null, rate: 1, play: true })
    expect(planSync(input({ video: 10.03 }))).toEqual({ seekTo: null, rate: 1, play: true })
  })

  it('waits paused when a little ahead (up to 1.3 s) and wakes when the sound gets there - no jump back', () => {
    expect(planSync(input({ video: 10.4 }))).toEqual({
      seekTo: null,
      rate: 1,
      play: false,
      wakeInMs: 400,
    })
    expect(planSync(input({ video: 11.2 }))).toMatchObject({
      seekTo: null,
      play: false,
      wakeInMs: 1200,
    })
  })

  it('jumps a little ahead of the sound when behind (then waits there), and straight back when ahead by more than it is worth waiting (the user rewound)', () => {
    expect(planSync(input({ video: 9.6 }))).toMatchObject({ seekTo: 10.5, play: false })
    expect(planSync(input({ video: 11.4 }))).toMatchObject({ seekTo: 10.5, play: false })
    expect(planSync(input({ video: 14 }))).toMatchObject({ seekTo: 10.5, play: false })
  })

  it('catches up with 5% faster playback when slightly behind, and waits with 5% slower when slightly ahead', () => {
    expect(planSync(input({ video: 9.8 }))).toEqual({ seekTo: null, rate: 1.05, play: true })
    expect(planSync(input({ video: 10.08 }))).toEqual({ seekTo: null, rate: 0.95, play: true })
    // 0.1 초보다 앞서면 멈춰 기다린다
    expect(planSync(input({ video: 10.2 }))).toEqual({
      seekTo: null,
      rate: 1,
      play: false,
      wakeInMs: 200,
    })
  })

  it('does not jump again right after a jump (the video is still loading there) - it just plays', () => {
    expect(planSync(input({ video: 20, sinceSeekMs: 400 }))).toEqual({
      seekTo: null,
      rate: 1,
      play: true,
    })
  })

  it('stops the video when the sound is not playing, and moves it onto the sound if the user moved the sound', () => {
    expect(planSync(input({ soundPlaying: false }))).toEqual({ seekTo: null, rate: 1, play: false })
    expect(planSync(input({ soundPlaying: false, video: 3 }))).toEqual({
      seekTo: 10,
      rate: 1,
      play: false,
    })
  })

  it('moves the video to its end and stops it there when the sound goes on past the end of the video', () => {
    expect(planSync(input({ sound: 199.99, video: 150, duration: 200 }))).toEqual({
      seekTo: 200,
      rate: 1,
      play: false,
    })
    // 이미 끝에 서 있으면 다시 옮기지 않는다
    expect(planSync(input({ sound: 199.99, video: 200, duration: 200 }))).toEqual({
      seekTo: null,
      rate: 1,
      play: false,
    })
    // 길이를 모르면(아직 불러오는 중) 끝으로 보지 않는다
    expect(planSync(input({ duration: NaN }))).toMatchObject({ play: true })
  })
})

function fakeVideo() {
  return {
    currentTime: 0,
    duration: 200,
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
  }
}

afterEach(() => vi.useRealTimers())

describe('followSound', () => {
  function setup(opts: { sound?: number; playing?: boolean; refuse?: boolean } = {}) {
    vi.useFakeTimers()
    const video = fakeVideo()
    const sound = { at: opts.sound ?? 0, playing: opts.playing ?? true }
    const onSynced = vi.fn()
    const onBlocked = vi.fn()
    if (opts.refuse)
      video.play.mockImplementation(() =>
        Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })),
      )
    const stop = followSound(
      video as never,
      { position: () => sound.at, playing: () => sound.playing },
      { onSynced, onBlocked },
    )
    return { video, sound, onSynced, onBlocked, stop }
  }

  it('starts the video at once when the sound is playing, and tells it is on the sound', () => {
    const { video, onSynced } = setup()
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(onSynced).toHaveBeenLastCalledWith(true)
  })

  it('moves a video that is far off a little ahead of the sound, waits there, and plays when the sound arrives', () => {
    const { video, sound, onSynced } = setup({ sound: 50 })
    expect(video.currentTime).toBe(50.5)
    expect(video.paused).toBe(true)
    expect(onSynced).toHaveBeenLastCalledWith(false)
    sound.at = 50.4
    vi.advanceTimersByTime(250)
    expect(onSynced).toHaveBeenLastCalledWith(true)
    // 소리가 닿을 때(0.1 초 뒤) 맞춰 다시 재서 튼다
    sound.at = 50.5
    vi.advanceTimersByTime(100)
    expect(video.paused).toBe(false)
  })

  it('does not tell it is on the sound while the video has no frame yet', () => {
    const { video, onSynced } = setup()
    expect(onSynced).toHaveBeenLastCalledWith(true)
    video.readyState = 0
    vi.advanceTimersByTime(250)
    expect(onSynced).toHaveBeenLastCalledWith(false)
  })

  it('pauses with the sound and plays again with it - without touching the sound', () => {
    const { video, sound } = setup()
    sound.playing = false
    vi.advanceTimersByTime(250)
    expect(video.pause).toHaveBeenCalled()
    sound.playing = true
    vi.advanceTimersByTime(250)
    expect(video.paused).toBe(false)
  })

  it('nudges the speed while it is slightly off and goes back to 1 when it is on the sound', () => {
    const { video, sound } = setup({ sound: 10 })
    video.currentTime = 9.8
    sound.at = 10
    vi.advanceTimersByTime(250)
    expect(video.playbackRate).toBe(1.05)
    video.currentTime = 10
    vi.advanceTimersByTime(250)
    expect(video.playbackRate).toBe(1)
  })

  it('leaves a video that is seeking alone', () => {
    const { video, sound } = setup({ sound: 10 })
    video.currentTime = 0
    video.seeking = true
    sound.at = 80
    vi.advanceTimersByTime(250)
    expect(video.currentTime).toBe(0)
  })

  it('does not measure or move a video that has no metadata yet (the start position would undo it)', () => {
    const { video, onSynced } = setup({ sound: 50 })
    video.currentTime = 0
    video.readyState = 0
    video.play.mockClear()
    vi.advanceTimersByTime(1000)
    expect(video.currentTime).toBe(0)
    expect(video.play).not.toHaveBeenCalled()
    expect(onSynced).toHaveBeenLastCalledWith(false)
  })

  it('stops measuring and puts the speed back to 1 when stopped', () => {
    const { video, sound, stop } = setup({ sound: 10 })
    video.currentTime = 9.8
    vi.advanceTimersByTime(250)
    expect(video.playbackRate).toBe(1.05)
    stop()
    expect(video.playbackRate).toBe(1)
    sound.at = 90
    vi.advanceTimersByTime(1000)
    expect(video.currentTime).toBe(9.8)
  })

  it('stops following when the browser refuses to play it (NotAllowedError), keeps the poster, and hands out a way to resume', async () => {
    const { video, sound, onSynced, onBlocked } = setup({ sound: 0, refuse: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(onBlocked).toHaveBeenCalledWith(expect.any(Function))
    expect(onSynced).toHaveBeenLastCalledWith(false)
    video.play.mockClear()
    video.currentTime = 3
    sound.at = 80
    await vi.advanceTimersByTimeAsync(5000)
    // 1초마다 옮기고 다시 거는 일을 되풀이하지 않는다
    expect(video.play).not.toHaveBeenCalled()
    expect(video.currentTime).toBe(3)
  })

  it('does not count other play() failures (an interrupted play, AbortError) as a refusal', async () => {
    vi.useFakeTimers()
    const video = fakeVideo()
    video.play.mockImplementation(() =>
      Promise.reject(Object.assign(new Error('interrupted'), { name: 'AbortError' })),
    )
    const onBlocked = vi.fn()
    followSound(video as never, { position: () => 10, playing: () => true }, { onBlocked })
    await vi.advanceTimersByTimeAsync(1000)
    expect(onBlocked).not.toHaveBeenCalled()
  })

  it('resumes inside the tap: plays at once, follows again, and clears the block', async () => {
    const { video, sound, onBlocked } = setup({ sound: 0, refuse: true })
    await vi.advanceTimersByTimeAsync(0)
    const resume = onBlocked.mock.calls[0]![0] as () => void
    video.play.mockClear()
    video.play.mockImplementation(function (this: { paused: boolean }) {
      this.paused = false
      return Promise.resolve()
    })
    resume()
    expect(video.play).toHaveBeenCalledTimes(1) // 손짓 안에서 바로
    await vi.advanceTimersByTimeAsync(0)
    expect(onBlocked).toHaveBeenLastCalledWith(null)
    video.currentTime = 9.8
    sound.at = 10
    await vi.advanceTimersByTimeAsync(250)
    expect(video.playbackRate).toBe(1.05) // 다시 따라간다
  })

  it('stays blocked when the tap is refused too', async () => {
    const { video, onBlocked } = setup({ sound: 0, refuse: true })
    await vi.advanceTimersByTimeAsync(0)
    const resume = onBlocked.mock.calls[0]![0] as () => void
    resume()
    await vi.advanceTimersByTimeAsync(0)
    expect(onBlocked).not.toHaveBeenCalledWith(null)
    video.play.mockClear()
    await vi.advanceTimersByTimeAsync(3000)
    expect(video.play).not.toHaveBeenCalled()
  })
})
