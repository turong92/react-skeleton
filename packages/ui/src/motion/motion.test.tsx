// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion, usePrefersReducedMotion } from './prefersReducedMotion'
import { startViewTransition } from './startViewTransition'
import { useCountUp } from './useCountUp'
import { useReveal } from './useReveal'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/* ---------- 가짜: matchMedia · IntersectionObserver · requestAnimationFrame ---------- */
let reduced = false
const mediaListeners = new Set<() => void>()
const setReduced = (value: boolean) => {
  reduced = value
  act(() => mediaListeners.forEach((listener) => listener()))
}

type FakeObserver = { callback: IntersectionObserverCallback; targets: Element[] }
let observers: FakeObserver[] = []
const enter = (index = 0) =>
  act(() => {
    const { callback, targets } = observers[index]
    callback(
      targets.map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry),
      {} as IntersectionObserver,
    )
  })

let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 1
const tick = (now: number) =>
  act(() => {
    const due = [...frames.values()]
    frames = new Map()
    due.forEach((callback) => callback(now))
  })

beforeEach(() => {
  reduced = false
  observers = []
  frames = new Map()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce') && reduced,
    addEventListener: (_: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => mediaListeners.delete(listener),
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private record: FakeObserver
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, targets: [] }
        observers.push(this.record)
      }
      observe(target: Element) {
        this.record.targets.push(target)
      }
      disconnect() {
        this.record.targets = []
      }
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(nextFrame, callback)
    return nextFrame++
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})

let root: Root | undefined
let host: HTMLElement
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  host?.remove()
  mediaListeners.clear()
  vi.unstubAllGlobals()
})

function mount(node: ReactNode) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root!.render(node))
}

/* ---------- usePrefersReducedMotion ---------- */
describe('prefersReducedMotion', () => {
  it('reads the media query, and is false without matchMedia', () => {
    expect(prefersReducedMotion()).toBe(false)
    reduced = true
    expect(prefersReducedMotion()).toBe(true)
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('the hook follows the setting while mounted', () => {
    function Probe() {
      return createElement('p', null, String(usePrefersReducedMotion()))
    }
    mount(createElement(Probe))
    expect(host.textContent).toBe('false')
    setReduced(true)
    expect(host.textContent).toBe('true')
  })
})

/* ---------- useReveal ---------- */
function Reveal({ index, staggerMs }: { index?: number; staggerMs?: number }) {
  const reveal = useReveal<HTMLLIElement>({ index, staggerMs })
  return createElement('li', reveal, 'item')
}
const item = () => host.querySelector('li')!

describe('useReveal', () => {
  it('hides on mount and shows once when it enters the view', () => {
    mount(createElement(Reveal))
    expect(item().dataset.reveal).toBe('hidden')
    enter()
    expect(item().dataset.reveal).toBe('shown')
    expect(observers[0].targets).toEqual([]) // 한 번 보였으면 더 지켜보지 않는다
  })

  it('stagger delay is index × step (default 60ms) as the transition delay', () => {
    mount(createElement(Reveal, { index: 3 }))
    expect(item().style.transitionDelay).toBe('180ms')
    act(() => root!.render(createElement(Reveal, { index: 2, staggerMs: 100 })))
    expect(item().style.transitionDelay).toBe('200ms')
  })

  it('with reduced motion the item is never hidden', () => {
    reduced = true
    mount(createElement(Reveal))
    expect(item().dataset.reveal).toBeUndefined()
    expect(observers).toEqual([])
  })

  it('without IntersectionObserver the item stays visible', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    mount(createElement(Reveal))
    expect(item().dataset.reveal).toBeUndefined()
  })
})

/* ---------- useCountUp ---------- */
function Count({
  target,
  startOnView,
  durationMs = 800,
}: {
  target: number
  startOnView?: boolean
  durationMs?: number
}) {
  const { value, ref } = useCountUp<HTMLSpanElement>(target, { startOnView, durationMs })
  return createElement('span', { ref }, String(value))
}
const text = () => host.textContent

describe('useCountUp', () => {
  it('counts from 0 to the target with ease-out and ends exactly on it', () => {
    mount(createElement(Count, { target: 1000 }))
    expect(text()).toBe('0')
    tick(100) // 첫 프레임이 시작 시각
    expect(text()).toBe('0')
    tick(500) // 400ms / 800ms = 0.5 → easeOutCubic 0.875
    expect(text()).toBe('875')
    tick(900)
    expect(text()).toBe('1000')
    expect(frames.size).toBe(0)
  })

  it('with reduced motion it is the target at once', () => {
    reduced = true
    mount(createElement(Count, { target: 42 }))
    expect(text()).toBe('42')
    expect(frames.size).toBe(0)
  })

  it('startOnView holds the start value until the element enters the view', () => {
    mount(createElement(Count, { target: 10, startOnView: true }))
    expect(text()).toBe('0')
    expect(frames.size).toBe(0)
    enter()
    tick(0)
    tick(800)
    expect(text()).toBe('10')
  })

  it('a new target counts on from the number shown', () => {
    mount(createElement(Count, { target: 100 }))
    tick(0)
    tick(800)
    expect(text()).toBe('100')
    act(() => root!.render(createElement(Count, { target: 200 })))
    tick(1000)
    tick(1000 + 800)
    expect(text()).toBe('200')
  })

  it('stops the frame loop on unmount', () => {
    mount(createElement(Count, { target: 10 }))
    expect(frames.size).toBe(1)
    act(() => root!.unmount())
    root = undefined
    expect(frames.size).toBe(0)
  })
})

/* ---------- startViewTransition ---------- */
describe('startViewTransition', () => {
  afterEach(() => {
    delete (document as { startViewTransition?: unknown }).startViewTransition
  })

  it('just runs the update when the API is missing', async () => {
    const update = vi.fn()
    await startViewTransition(update)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('runs the update inside the transition and waits for it to finish', async () => {
    const update = vi.fn()
    const start = vi.fn((callback: () => void) => {
      callback()
      return { finished: Promise.resolve() }
    })
    ;(document as { startViewTransition?: unknown }).startViewTransition = start
    await startViewTransition(update)
    expect(start).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('with reduced motion it skips the transition', async () => {
    reduced = true
    const start = vi.fn()
    ;(document as { startViewTransition?: unknown }).startViewTransition = start
    const update = vi.fn()
    await startViewTransition(update)
    expect(start).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })
})
