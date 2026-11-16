import { describe, expect, it, vi } from 'vitest'
import { playAfterAttach } from './playAfterAttach'

function fakeMedia(result: () => Promise<void>) {
  const listeners = new Map<string, () => void>()
  const media = {
    paused: true,
    play: vi.fn(result),
    addEventListener: vi.fn((type: string, fn: () => void) => void listeners.set(type, fn)),
    removeEventListener: vi.fn((type: string) => void listeners.delete(type)),
  }
  return { media, listeners }
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const abort = () => Promise.reject(Object.assign(new Error('interrupted'), { name: 'AbortError' }))
const blocked = () =>
  Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }))

describe('playAfterAttach', () => {
  it('does not call a play() that hls.js interrupted by attaching the stream a refusal', async () => {
    const { media } = fakeMedia(abort)
    const onRejected = vi.fn()
    playAfterAttach(media, 'hlsjs', onRejected)
    await flush()
    expect(onRejected).not.toHaveBeenCalled()
  })

  it('reports a real refusal (the browser blocked playback without a gesture)', async () => {
    const { media } = fakeMedia(blocked)
    const onRejected = vi.fn()
    playAfterAttach(media, 'native', onRejected)
    await flush()
    expect(onRejected).toHaveBeenCalledTimes(1)
  })

  it('plays again when the metadata arrives while it is still wanted and still paused (hls.js only)', () => {
    const { media, listeners } = fakeMedia(() => Promise.resolve())
    playAfterAttach(media, 'hlsjs', vi.fn())
    expect(media.play).toHaveBeenCalledTimes(1)
    listeners.get('loadedmetadata')?.()
    expect(media.play).toHaveBeenCalledTimes(2)
  })

  it('does not play again once cancelled (the user paused or the step was replaced)', () => {
    const { media, listeners } = fakeMedia(() => Promise.resolve())
    const cancel = playAfterAttach(media, 'hlsjs', vi.fn())
    cancel()
    expect(listeners.has('loadedmetadata')).toBe(false)
  })

  it('does not listen at all on native HLS, and does not play again when it already plays', () => {
    const native = fakeMedia(() => Promise.resolve())
    playAfterAttach(native.media, 'native', vi.fn())
    expect(native.listeners.size).toBe(0)
    const playing = fakeMedia(() => Promise.resolve())
    playAfterAttach(playing.media, 'hlsjs', vi.fn())
    playing.media.paused = false
    playing.listeners.get('loadedmetadata')?.()
    expect(playing.media.play).toHaveBeenCalledTimes(1)
  })
})
