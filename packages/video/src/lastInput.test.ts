import { describe, expect, it } from 'vitest'
import { watchInput } from './lastInput'
import { createPlayIntent } from './playIntent'

function fakeDoc() {
  const listeners = new Map<string, { fn: () => void; capture: boolean }>()
  return {
    listeners,
    addEventListener: (type: string, fn: () => void, capture: boolean) =>
      void listeners.set(type, { fn, capture }),
    removeEventListener: (type: string) => void listeners.delete(type),
    fire: (type: string) => listeners.get(type)?.fn(),
  }
}

function clock() {
  let t = 0
  return { now: () => t, tick: (ms: number) => void (t += ms) }
}

describe('watchInput', () => {
  it("listens in the capture phase, so a tap on the video's own controls counts", () => {
    const doc = fakeDoc()
    watchInput(doc)
    expect(doc.listeners.get('pointerdown')?.capture).toBe(true)
    expect(doc.listeners.has('keydown')).toBe(true)
  })

  it('knows whether an input just happened', () => {
    const c = clock()
    const doc = fakeDoc()
    const input = watchInput(doc, c.now)
    expect(input.recent()).toBe(false)
    doc.fire('pointerdown')
    c.tick(300)
    expect(input.recent()).toBe(true)
    c.tick(1000)
    expect(input.recent()).toBe(false)
  })

  it('stops listening', () => {
    const doc = fakeDoc()
    watchInput(doc).stop()
    expect(doc.listeners.size).toBe(0)
  })
})

describe('watchInput + play intent (the pocket case)', () => {
  function run(inputToPauseMs: number | null) {
    const c = clock()
    const doc = fakeDoc()
    const input = watchInput(doc, c.now)
    const intent = createPlayIntent(c.now)
    doc.fire('pointerdown') // 재생을 누른다
    intent.play()
    if (inputToPauseMs === null)
      c.tick(2000) // 2초 뒤 주머니에 넣는다 - 입력 없이 OS 가 멈춘다
    else c.tick(inputToPauseMs)
    intent.pause(input.recent())
    c.tick(250)
    return intent.wasPlaying()
  }

  it('hands over when the OS pauses 2s after pressing play', () => {
    expect(run(null)).toBe(true)
  })

  it('does not hand over when the pause comes right after a tap on the screen', () => {
    expect(run(100)).toBe(false)
  })
})
