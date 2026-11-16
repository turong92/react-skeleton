import { describe, expect, it, vi } from 'vitest'
import { bindMediaSession } from './mediaSession'

type Handler = (details: { seekTime?: number | null }) => void

function fakeSession() {
  const handlers = new Map<string, Handler | null>()
  return {
    metadata: null as unknown,
    handlers,
    setActionHandler: (action: string, handler: Handler | null) =>
      void handlers.set(action, handler),
    active: () => [...handlers].filter(([, h]) => h).map(([a]) => a),
  }
}

class FakeMetadata {
  init: { title?: string; artwork?: Array<{ src: string }> }
  constructor(init: { title?: string; artwork?: Array<{ src: string }> }) {
    this.init = init
  }
}

function fakeMedia() {
  return { currentTime: 30, duration: 100, play: vi.fn(() => Promise.resolve()), pause: vi.fn() }
}

describe('bindMediaSession', () => {
  it('shows the title and the poster on the lock screen', () => {
    const session = fakeSession()
    bindMediaSession(
      session,
      { title: 'Song', poster: 'https://cdn.test/p.jpg', media: () => null },
      FakeMetadata,
    )
    expect(session.metadata).toBeInstanceOf(FakeMetadata)
    expect((session.metadata as FakeMetadata).init).toMatchObject({
      title: 'Song',
      artwork: [{ src: 'https://cdn.test/p.jpg' }],
    })
  })

  it('leaves the metadata alone when the app gave neither title nor poster', () => {
    const session = fakeSession()
    bindMediaSession(session, { media: () => null }, FakeMetadata)
    expect(session.metadata).toBeNull()
  })

  it('registers play, pause and seek, and ±10 seconds when there is no previous/next', () => {
    const session = fakeSession()
    const media = fakeMedia()
    bindMediaSession(session, { media: () => media })
    expect(session.active().sort()).toEqual(
      ['pause', 'play', 'seekbackward', 'seekforward', 'seekto'].sort(),
    )
    session.handlers.get('seekbackward')!({})
    expect(media.currentTime).toBe(20)
    session.handlers.get('seekforward')!({})
    session.handlers.get('seekforward')!({})
    expect(media.currentTime).toBe(40)
    session.handlers.get('seekto')!({ seekTime: 12 })
    expect(media.currentTime).toBe(12)
    session.handlers.get('play')!({})
    session.handlers.get('pause')!({})
    expect(media.play).toHaveBeenCalled()
    expect(media.pause).toHaveBeenCalled()
  })

  it('tells the owner the pause was the viewer own, before pausing', () => {
    const session = fakeSession()
    const media = fakeMedia()
    const order: string[] = []
    media.pause.mockImplementation(() => void order.push('pause'))
    bindMediaSession(session, { media: () => media, onUserPause: () => order.push('user') })
    session.handlers.get('pause')!({})
    expect(order).toEqual(['user', 'pause'])
  })

  it('does not go below zero or past the end', () => {
    const session = fakeSession()
    const media = fakeMedia()
    bindMediaSession(session, { media: () => media })
    media.currentTime = 4
    session.handlers.get('seekbackward')!({})
    expect(media.currentTime).toBe(0)
    media.currentTime = 95
    session.handlers.get('seekforward')!({})
    expect(media.currentTime).toBe(100)
  })

  it('with previous/next given shows only those two buttons - no seek buttons, or the phone shows ±10s instead', () => {
    const session = fakeSession()
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    bindMediaSession(session, { media: () => fakeMedia(), onPrevious, onNext })
    expect(session.active()).toContain('previoustrack')
    expect(session.active()).toContain('nexttrack')
    expect(session.active()).not.toContain('seekbackward')
    expect(session.active()).not.toContain('seekforward')
    session.handlers.get('nexttrack')!({})
    session.handlers.get('previoustrack')!({})
    expect(onNext).toHaveBeenCalled()
    expect(onPrevious).toHaveBeenCalled()
  })

  it('with only one of previous/next still keeps the seek buttons out (one app decision, not two)', () => {
    const session = fakeSession()
    bindMediaSession(session, { media: () => fakeMedia(), onNext: vi.fn() })
    expect(session.active()).toContain('nexttrack')
    expect(session.active()).not.toContain('previoustrack')
    expect(session.active()).not.toContain('seekforward')
  })

  it('acts on whichever element is playing now', () => {
    const session = fakeSession()
    const video = fakeMedia()
    const audio = fakeMedia()
    let current = video
    bindMediaSession(session, { media: () => current })
    current = audio
    session.handlers.get('pause')!({})
    expect(audio.pause).toHaveBeenCalled()
    expect(video.pause).not.toHaveBeenCalled()
  })

  it('removes every handler and the metadata when torn down', () => {
    const session = fakeSession()
    const stop = bindMediaSession(
      session,
      { title: 'Song', media: () => null, onNext: vi.fn() },
      FakeMetadata,
    )
    stop()
    expect(session.active()).toEqual([])
    expect(session.metadata).toBeNull()
  })

  it('skips an action name the browser does not know instead of throwing', () => {
    const session = fakeSession()
    session.setActionHandler = (action, handler) => {
      if (action === 'seekto') throw new TypeError('unsupported')
      session.handlers.set(action, handler)
    }
    expect(() => bindMediaSession(session, { media: () => null })).not.toThrow()
    expect(session.active()).toContain('play')
  })

  it('does nothing when the browser has no media session', () => {
    expect(() => bindMediaSession(undefined, { media: () => null })()).not.toThrow()
  })
})
