import { describe, expect, it, vi } from 'vitest'
import { watchHidden, wakeAudio } from './autoAudio'
import { createPlayIntent } from './playIntent'

function fakeDoc(state: 'visible' | 'hidden' = 'visible') {
  let listener: (() => void) | null = null
  return {
    visibilityState: state as string,
    addEventListener: (_n: string, fn: () => void) => void (listener = fn),
    removeEventListener: () => void (listener = null),
    hide() {
      this.visibilityState = 'hidden'
      listener?.()
    },
    get listening() {
      return listener !== null
    },
  }
}

function fakeAudio() {
  return { src: '', currentTime: 0, play: vi.fn(() => Promise.resolve()), pause: vi.fn() }
}

describe('wakeAudio', () => {
  it('points the audio at the sound-only playlist, plays and pauses at once without waiting', () => {
    const audio = fakeAudio()
    const order: string[] = []
    audio.play.mockImplementation(() => {
      order.push('play')
      return new Promise(() => {}) // 끝나지 않아도 pause 까지 간다(기다리면 영상 시작이 막힌다)
    })
    audio.pause.mockImplementation(() => void order.push('pause'))
    wakeAudio(audio, 'https://cdn.test/a.m3u8')
    expect(audio.src).toBe('https://cdn.test/a.m3u8')
    expect(order).toEqual(['play', 'pause'])
  })

  it('ignores a refused play', () => {
    const audio = fakeAudio()
    audio.play.mockReturnValue(Promise.reject(new Error('NotAllowedError')))
    expect(() => wakeAudio(audio, 'x')).not.toThrow()
  })
})

describe('watchHidden', () => {
  function setup(opts: { native?: boolean; playing?: boolean } = {}) {
    const doc = fakeDoc()
    const intent = createPlayIntent()
    if (opts.playing ?? true) intent.play()
    const video = { currentTime: 37.5 }
    const audio = fakeAudio()
    const onHandoff = vi.fn()
    const stop = watchHidden({
      doc,
      intent,
      video: () => video,
      audio: () => audio,
      native: opts.native ?? true,
      onHandoff,
    })
    return { doc, intent, video, audio, onHandoff, stop }
  }

  it('on hidden while playing, plays the audio from the same moment inside the same event (native)', () => {
    const { doc, audio, onHandoff } = setup()
    doc.hide()
    expect(audio.currentTime).toBe(37.5)
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(onHandoff).toHaveBeenCalledWith({ at: 37.5, adopt: true })
  })

  it('judges by what the viewer wanted, not by the paused flag the OS already set', () => {
    const { doc, intent, audio, onHandoff } = setup()
    intent.pause() // OS 가 먼저 멈췄다
    doc.hide()
    expect(audio.play).toHaveBeenCalled()
    expect(onHandoff).toHaveBeenCalled()
  })

  it('does nothing when the viewer had paused', () => {
    const { doc, audio, onHandoff } = setup({ playing: false })
    doc.hide()
    expect(audio.play).not.toHaveBeenCalled()
    expect(onHandoff).not.toHaveBeenCalled()
  })

  it('without native HLS only asks for the switch (hls.js attaches after it)', () => {
    const { doc, audio, onHandoff } = setup({ native: false })
    doc.hide()
    expect(audio.play).not.toHaveBeenCalled()
    expect(onHandoff).toHaveBeenCalledWith({ at: 37.5, adopt: false })
  })

  it('stops listening when torn down', () => {
    const { doc, stop } = setup()
    stop()
    expect(doc.listening).toBe(false)
  })
})
