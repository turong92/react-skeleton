import { describe, expect, it, vi } from 'vitest'
import { toggleFullscreen, fullscreenKindOf } from './fullscreen'

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

const plainDoc = { fullscreenElement: null, exitFullscreen: () => Promise.resolve() }

describe('toggleFullscreen', () => {
  it('asks the frame for frame, the video for video', () => {
    const frame = { requestFullscreen: vi.fn(() => Promise.resolve()) }
    const video = { webkitEnterFullscreen: vi.fn() }
    toggleFullscreen('frame', frame, video, plainDoc)
    expect(frame.requestFullscreen).toHaveBeenCalled()
    expect(video.webkitEnterFullscreen).not.toHaveBeenCalled()
    toggleFullscreen('video', frame, video, plainDoc)
    expect(video.webkitEnterFullscreen).toHaveBeenCalled()
  })

  it('swallows a refusal', async () => {
    const frame = { requestFullscreen: vi.fn(() => Promise.reject(new Error('denied'))) }
    expect(() => toggleFullscreen('frame', frame, null, plainDoc)).not.toThrow()
    await Promise.resolve()
  })
})

describe('toggleFullscreen - leaving', () => {
  it('leaves the full screen when the frame already is in it', () => {
    const frame = { requestFullscreen: vi.fn(() => Promise.resolve()) }
    const doc = { fullscreenElement: {}, exitFullscreen: vi.fn(() => Promise.resolve()) }
    toggleFullscreen('frame', frame, null, doc)
    expect(doc.exitFullscreen).toHaveBeenCalled()
    expect(frame.requestFullscreen).not.toHaveBeenCalled()
  })
})
