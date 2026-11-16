import { describe, expect, it, vi } from 'vitest'
import { enterFullscreen, fullscreenKindOf } from './fullscreen'

describe('fullscreenKindOf', () => {
  it('uses the player frame where the Fullscreen API is available (desktop, Android)', () => {
    expect(fullscreenKindOf({ fullscreenEnabled: true }, {})).toBe('frame')
  })

  it('uses the video itself on iPhone, which only fullscreens the native video', () => {
    expect(
      fullscreenKindOf({ fullscreenEnabled: false }, { webkitEnterFullscreen: () => {} }),
    ).toBe('video')
    expect(fullscreenKindOf({}, { webkitEnterFullscreen: () => {} })).toBe('video')
  })

  it('prefers the frame when both exist (iPad), so our own buttons stay', () => {
    expect(fullscreenKindOf({ fullscreenEnabled: true }, { webkitEnterFullscreen: () => {} })).toBe(
      'frame',
    )
  })

  it('has no button when neither works', () => {
    expect(fullscreenKindOf({ fullscreenEnabled: false }, {})).toBeNull()
    expect(fullscreenKindOf({}, undefined)).toBeNull()
  })
})

describe('enterFullscreen', () => {
  it('asks the frame for frame, the video for video', () => {
    const frame = { requestFullscreen: vi.fn(() => Promise.resolve()) }
    const video = { webkitEnterFullscreen: vi.fn() }
    enterFullscreen('frame', frame, video)
    expect(frame.requestFullscreen).toHaveBeenCalled()
    expect(video.webkitEnterFullscreen).not.toHaveBeenCalled()
    enterFullscreen('video', frame, video)
    expect(video.webkitEnterFullscreen).toHaveBeenCalled()
  })

  it('swallows a refusal', async () => {
    const frame = { requestFullscreen: vi.fn(() => Promise.reject(new Error('denied'))) }
    expect(() => enterFullscreen('frame', frame, null)).not.toThrow()
    await Promise.resolve()
  })
})
