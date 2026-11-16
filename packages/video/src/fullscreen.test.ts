import { describe, expect, it, vi } from 'vitest'
import { toggleFullscreen, fullscreenKindOf, leaveFullscreenOf } from './fullscreen'

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

describe('leaveFullscreenOf', () => {
  const doc = (fullscreenElement: unknown) => ({
    fullscreenElement,
    exitFullscreen: vi.fn(() => Promise.resolve()),
  })

  it('leaves the full screen when the stage (or something in it) is the full screen element', () => {
    const inside = {}
    const stage = { contains: (node: unknown) => node === inside }
    const d = doc(inside)
    leaveFullscreenOf(stage, d)
    expect(d.exitFullscreen).toHaveBeenCalled()
  })

  it('leaves another stage, or no full screen at all, alone', () => {
    const stage = { contains: () => false }
    const other = doc({})
    leaveFullscreenOf(stage, other)
    expect(other.exitFullscreen).not.toHaveBeenCalled()
    const none = doc(null)
    leaveFullscreenOf({ contains: () => true }, none)
    expect(none.exitFullscreen).not.toHaveBeenCalled()
    leaveFullscreenOf(null, doc({}))
  })
})
