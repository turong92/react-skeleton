import type { GoogletagEventMap, GoogletagLike, GoogletagSlot } from './googletag'

export type FakeRewardedOutcome = 'granted' | 'closed' | 'no-fill' | 'load-error'

export type FakeGoogletagOptions = {
  /** 광고가 어떻게 끝나는가. 기본 `granted` */
  outcome?: FakeRewardedOutcome
  /** 「보기」를 누른 뒤 끝나기까지(ms). 기본 8000 — 서버 `min-elapsed` 7초보다 길게 잡은 값 */
  watchMs?: number
}

type Listener = (event: never) => void

/**
 * 로컬 · 시험 · 스토리용 가짜 googletag. 쓰는 부분만 흉내 내고 미디어 요소를 만들지 않으니 소리가 나지 않는다.
 * 앱이 `loadGoogletag: createFakeGoogletag().loader` 로 끼운다.
 */
export function createFakeGoogletag({
  outcome = 'granted',
  watchMs = 8000,
}: FakeGoogletagOptions = {}) {
  const listeners = new Map<string, Set<Listener>>()
  const destroyed = new Set<GoogletagSlot>()
  const emit = <K extends keyof GoogletagEventMap>(
    type: K,
    slot: GoogletagSlot,
    event: GoogletagEventMap[K],
  ) => {
    if (destroyed.has(slot)) return
    listeners.get(type)?.forEach((listener) => listener(event as never))
  }

  const pubads = {
    addEventListener(type: string, listener: Listener) {
      const set = listeners.get(type) ?? new Set<Listener>()
      listeners.set(type, set.add(listener))
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener)
    },
  }

  const googletag: GoogletagLike = {
    cmd: { push: (callback) => void callback() },
    enums: { OutOfPageFormat: { REWARDED: 'REWARDED' } },
    defineOutOfPageSlot: () => {
      const slot: GoogletagSlot = { addService: () => slot }
      return slot
    },
    pubads: () => pubads as never,
    enableServices: () => {},
    display: (slot) => {
      setTimeout(() => {
        if (outcome === 'no-fill') {
          emit('slotRenderEnded', slot, { slot, isEmpty: true })
          return
        }
        emit('rewardedSlotReady', slot, {
          slot,
          makeRewardedVisible: () => {
            setTimeout(() => {
              if (outcome === 'granted') emit('rewardedSlotGranted', slot, { slot })
              emit('rewardedSlotClosed', slot, { slot })
            }, watchMs)
            return true
          },
        })
      }, 0)
    },
    destroySlots: (slots) => {
      slots.forEach((slot) => destroyed.add(slot))
      return true
    },
  }

  return {
    loader: (): Promise<GoogletagLike> =>
      outcome === 'load-error'
        ? Promise.reject(new Error('Fake GPT: simulated load error'))
        : Promise.resolve(googletag),
  }
}
