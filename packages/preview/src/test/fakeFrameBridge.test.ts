import { describe, expect, it, vi } from 'vitest'
import { createFakeFrameBridge } from './fakeFrameBridge'

/** setAttribute · addEventListener · removeEventListener 만 가진 가짜 iframe */
function fakeIframe() {
  return {
    setAttribute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLIFrameElement
}

describe('createFakeFrameBridge', () => {
  it('a minimal fake has none of the optional bridge members', () => {
    const b = createFakeFrameBridge({ minimal: true })
    for (const k of [
      'front',
      'onSwap',
      'contentHeight',
      'onHeight',
      'modal',
      'onModal',
      'viewport',
      'onScrollTo',
      'flushScroll',
    ])
      expect(k in b).toBe(false)
  })

  it('html shown before attach lands on the first attach, and detach releases everything', () => {
    const b = createFakeFrameBridge()
    b.show('<p>x</p>')
    const frame = fakeIframe()
    const detach = b.attach(frame)
    expect(frame.setAttribute).toHaveBeenCalledWith('srcdoc', '<p>x</p>')
    expect(b.attachCount()).toBe(1)
    detach()
    expect(b.listenerCount()).toBe(0)
  })

  it('knows the height it was given and tells its listeners about modal and scroll requests', () => {
    const b = createFakeFrameBridge({ height: 2400 })
    expect(b.contentHeight).toBe(2400)
    const modal: boolean[] = []
    const scrolls: Array<[number, number]> = []
    const offModal = b.onModal?.((open) => modal.push(open))
    const offScroll = b.onScrollTo?.((top, room) => scrolls.push([top, room]))
    b.emitModal(true)
    b.emitScrollTo(400, 28)
    expect(b.modal).toBe(true)
    expect(modal).toEqual([true])
    expect(scrolls).toEqual([[400, 28]])
    expect(b.listenerCount()).toBe(2)
    offModal?.()
    offScroll?.()
    expect(b.listenerCount()).toBe(0)
  })
})
