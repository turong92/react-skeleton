/* googletag(GPT) 중 이 패키지가 쓰는 부분만 — 외부 타입 패키지 없이 여기에 둔다 */

/** `defineOutOfPageSlot` 이 돌려주는 슬롯. 이 패키지는 내용을 읽지 않는다 */
export type GoogletagSlot = { addService(service: unknown): unknown }

export type RewardedSlotReadyEvent = { slot: GoogletagSlot; makeRewardedVisible(): boolean }
export type RewardedSlotGrantedEvent = { slot: GoogletagSlot }
export type RewardedSlotClosedEvent = { slot: GoogletagSlot }
export type SlotRenderEndedEvent = { slot: GoogletagSlot; isEmpty: boolean }

export type GoogletagEventMap = {
  rewardedSlotReady: RewardedSlotReadyEvent
  rewardedSlotGranted: RewardedSlotGrantedEvent
  rewardedSlotClosed: RewardedSlotClosedEvent
  slotRenderEnded: SlotRenderEndedEvent
}

export type GoogletagPubads = {
  addEventListener<K extends keyof GoogletagEventMap>(
    type: K,
    listener: (event: GoogletagEventMap[K]) => void,
  ): unknown
  removeEventListener<K extends keyof GoogletagEventMap>(
    type: K,
    listener: (event: GoogletagEventMap[K]) => void,
  ): unknown
}

export type GoogletagLike = {
  cmd: { push(callback: () => void): unknown }
  enums: { OutOfPageFormat: { REWARDED: unknown } }
  defineOutOfPageSlot(adUnitPath: string, format: unknown): GoogletagSlot | null
  pubads(): GoogletagPubads
  enableServices(): void
  display(slot: GoogletagSlot): void
  destroySlots(slots: GoogletagSlot[]): boolean
}

export const GPT_SCRIPT_SRC = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'

export type GoogletagLoaderEnv = {
  /** 스크립트 주소(프록시 · 테스트). 기본 {@link GPT_SCRIPT_SRC} */
  src?: string
  window?: { googletag?: Partial<GoogletagLike> }
  document?: {
    createElement(tag: 'script'): {
      src: string
      async: boolean
      onload: null | (() => void)
      onerror: null | (() => void)
    }
    head: { appendChild(node: never): unknown }
  }
}

// window 마다 따로 기억한다 — 한 페이지에 스크립트는 한 번만 붙는다
const loading = new WeakMap<object, Map<string, Promise<GoogletagLike>>>()

/**
 * GPT 스크립트를 한 번만 불러 `window.googletag` 를 돌려준다. 로드 중이면 같은 약속, 실패하면 다음 호출이 다시 시도한다.
 * 브라우저가 아니면(서버 렌더) 거절한다. `env` 로 `window` · `document` 를 바꿔 끼울 수 있다(테스트).
 */
export function loadGoogletag(env: GoogletagLoaderEnv = {}): Promise<GoogletagLike> {
  const win: GoogletagLoaderEnv['window'] =
    'window' in env ? env.window : (globalThis as { window?: GoogletagLoaderEnv['window'] }).window
  const doc: GoogletagLoaderEnv['document'] =
    'document' in env
      ? env.document
      : (globalThis as { document?: GoogletagLoaderEnv['document'] }).document
  if (!win || !doc) return Promise.reject(new Error('GPT needs a browser (no window/document)'))

  const src = env.src ?? GPT_SCRIPT_SRC
  const bySrc = loading.get(win) ?? new Map<string, Promise<GoogletagLike>>()
  loading.set(win, bySrc)
  const known = bySrc.get(src)
  if (known) return known

  const promise = new Promise<GoogletagLike>((resolve, reject) => {
    const script = doc.createElement('script')
    script.src = src
    script.async = true
    const fail = (why: string) => {
      bySrc.delete(src)
      reject(new Error(`Failed to load the GPT script: ${why}`))
    }
    script.onload = () => {
      if (win.googletag) resolve(win.googletag as GoogletagLike)
      else fail('window.googletag is missing after load')
    }
    script.onerror = () => fail(`could not fetch ${src} (blocked or offline?)`)
    doc.head.appendChild(script as never)
  })
  bySrc.set(src, promise)
  return promise
}
