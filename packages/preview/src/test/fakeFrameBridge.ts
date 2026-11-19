import type { PreviewFrameBridge } from '../source'

/** 스토리 · 테스트 전용 다리 — 시험 도우미(`show` · `attachCount` · `listenerCount` · `emit*`)가 더 있다 */
export type FakeFrameBridge = PreviewFrameBridge & {
  show(html: string): void
  attachCount(): number
  listenerCount(): number
  emitModal(open: boolean): void
  emitScrollTo(top: number, room: number): void
}

/**
 * `setAttribute('srcdoc', html)` 로 싣고, `sampleHtml({ reportHeight: true })` 문서가 보내는 `{ type: 'sample-preview-height', height }` 를
 * `event.source === frame.contentWindow` 일 때만 받는다(`window` 가 없으면 듣지 않는다). `height` 는 처음 `contentHeight`.
 * `minimal: true` 면 다리 멤버는 `attach` 뿐(`emit*` 도 없다)
 */
export function createFakeFrameBridge(options?: {
  html?: string
  minimal?: boolean
  height?: number
}): FakeFrameBridge {
  let html = options?.html ?? null
  let height: number | null = options?.height ?? null
  let modal = false
  let attaches = 0
  let current: HTMLIFrameElement | null = null
  let onMessage: ((event: MessageEvent) => void) | null = null
  const heightListeners = new Set<(height: number | null) => void>()
  const modalListeners = new Set<(open: boolean) => void>()
  const scrollListeners = new Set<(top: number, room: number) => void>()
  const swapListeners = new Set<() => void>()

  const subscribe = <A extends unknown[]>(
    set: Set<(...args: A) => void>,
    listener: (...args: A) => void,
  ) => {
    set.add(listener)
    return () => {
      set.delete(listener)
    }
  }

  const attach = (frame: HTMLIFrameElement) => {
    attaches += 1
    current = frame
    if (html !== null) frame.setAttribute('srcdoc', html)
    if (typeof window !== 'undefined') {
      onMessage = (event) => {
        const data = event.data as { type?: unknown; height?: unknown } | null
        if (event.source !== frame.contentWindow) return
        if (data?.type !== 'sample-preview-height' || typeof data.height !== 'number') return
        height = data.height
        heightListeners.forEach((listener) => listener(height))
      }
      window.addEventListener('message', onMessage)
    }
    return () => {
      if (onMessage && typeof window !== 'undefined')
        window.removeEventListener('message', onMessage)
      onMessage = null
      if (current === frame) current = null
    }
  }

  const helpers = {
    show(next: string) {
      html = next
      current?.setAttribute('srcdoc', next)
    },
    attachCount: () => attaches,
    listenerCount: () =>
      heightListeners.size +
      modalListeners.size +
      scrollListeners.size +
      swapListeners.size +
      (onMessage ? 1 : 0),
  }

  if (options?.minimal) return { attach, ...helpers } as FakeFrameBridge

  return {
    attach,
    ...helpers,
    get front() {
      return current
    },
    onSwap: (listener) => subscribe(swapListeners, listener),
    get contentHeight() {
      return height
    },
    onHeight: (listener) => subscribe(heightListeners, listener),
    get modal() {
      return modal
    },
    onModal: (listener) => subscribe(modalListeners, listener),
    viewport: () => undefined,
    onScrollTo: (listener) => subscribe(scrollListeners, listener),
    flushScroll: () => undefined,
    emitModal(open) {
      modal = open
      modalListeners.forEach((listener) => listener(open))
    },
    emitScrollTo(top, room) {
      scrollListeners.forEach((listener) => listener(top, room))
    },
  }
}
