import { describe, expect, it } from 'vitest'
import { createPlayIntent } from './playIntent'

function clock() {
  let t = 0
  return { now: () => t, tick: (ms: number) => void (t += ms) }
}

describe('createPlayIntent', () => {
  it('is not playing before anything plays', () => {
    expect(createPlayIntent().wasPlaying()).toBe(false)
  })

  it('is playing after a play event', () => {
    const intent = createPlayIntent()
    intent.play()
    expect(intent.wasPlaying()).toBe(true)
  })

  it('still counts as playing when the OS paused the video an instant before the screen went off', () => {
    const c = clock()
    const intent = createPlayIntent(c.now)
    intent.play()
    intent.pause() // 잠그는 순간 OS 가 <video> 를 먼저 멈춘다
    c.tick(50) // visibilitychange 는 그 직전·직후에 온다
    expect(intent.wasPlaying()).toBe(true)
  })

  it('does not count a pause the viewer made a while ago', () => {
    const c = clock()
    const intent = createPlayIntent(c.now)
    intent.play()
    intent.pause()
    c.tick(5_000)
    expect(intent.wasPlaying()).toBe(false)
  })

  it('does not count a video that played to the end', () => {
    const intent = createPlayIntent()
    intent.play()
    intent.pause() // 끝나면 pause 가 ended 보다 먼저 온다
    intent.ended()
    expect(intent.wasPlaying()).toBe(false)
  })
})
