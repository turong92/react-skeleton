import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { loadGoogletag as loadRealGoogletag } from './googletag'
import type {
  GoogletagEventMap,
  GoogletagLike,
  GoogletagSlot,
  RewardedSlotReadyEvent,
} from './googletag'
import type { WebRewardedApi, WebRewardedGrant } from './types'

export type RewardedAdStatus =
  | 'idle'
  | 'opening'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'granting'
  | 'rewarded'
  | 'forfeited'
  | 'unavailable'
  | 'limited'
  | 'failed'

export type RewardedAdState = {
  status: RewardedAdStatus
  grant?: WebRewardedGrant
  error?: unknown
}

export type RewardedAdOptions = {
  api: WebRewardedApi
  /** Ad Manager 보상형 광고 단위 경로(예: `/1234567/rewarded`) */
  adUnitPath: string
  /** 서버에 알리는 보상 목적(`^[a-z0-9][a-z0-9._-]{0,63}$`) */
  purpose: string
  /** googletag 를 얻는 길. 기본은 진짜 GPT 로더 — 로컬 · 시험은 `createFakeGoogletag().loader` */
  loadGoogletag?: () => Promise<GoogletagLike>
  /** 사용자 활성 여부. 기본 `navigator.userActivation?.isActive ?? true`(없는 브라우저는 통과) */
  isUserActive?: () => boolean
}

export type RewardedAd = {
  getState(): RewardedAdState
  subscribe(listener: () => void): () => void
  /** 세션을 열고 광고를 불러온다. `idle` · 끝 상태에서만 듣는다. 스스로 부르지 않는다(자동 연속 재생 금지) */
  start(): void
  /** `ready` 에서 사용자 손짓(클릭) 핸들러 안에서만 부른다 — 광고를 보여 준다 */
  watch(): void
  /** `ready`(동의 창)에서 「나중에」 — 슬롯을 지우고 `idle` 로 */
  cancel(): void
  destroy(): void
}

const RESTARTABLE: ReadonlySet<RewardedAdStatus> = new Set([
  'idle',
  'rewarded',
  'forfeited',
  'unavailable',
  'limited',
  'failed',
])

export function defaultIsUserActive(): boolean {
  return (typeof navigator !== 'undefined' && navigator.userActivation?.isActive) ?? true
}

/** 서버가 하루 상한(409)으로 거절했으면 `limited`, 그 밖은 `failed` — 세션 열기 · 보상 요청이 같은 규칙 */
const failure = (error: unknown): RewardedAdState =>
  isErrorCode(error, ErrorCodes.ADS_WEB_REWARDED_DAILY_LIMIT)
    ? { status: 'limited' }
    : { status: 'failed', error }

/** 한 번의 `start()` 가 쥐고 있는 것 */
type Run = {
  googletag?: GoogletagLike
  slot?: GoogletagSlot
  ready?: RewardedSlotReadyEvent
  grantRequested: boolean
  removeListeners: Array<() => void>
}

/**
 * 보상형 광고 흐름 컨트롤러(프레임워크 없음). `idle → opening → loading → ready → playing → granting → rewarded`,
 * 끝 상태는 `rewarded` · `forfeited`(granted 없이 닫힘) · `unavailable`(광고 없음) · `limited`(하루 상한) · `failed`.
 */
export function createRewardedAd(options: RewardedAdOptions): RewardedAd {
  const {
    api,
    adUnitPath,
    purpose,
    loadGoogletag = loadRealGoogletag,
    isUserActive = defaultIsUserActive,
  } = options
  let state: RewardedAdState = { status: 'idle' }
  const subscribers = new Set<() => void>()
  let run: Run | null = null
  let destroyed = false

  const set = (next: RewardedAdState) => {
    state = next
    subscribers.forEach((listener) => listener())
  }

  const destroySlot = (r: Run) => {
    r.removeListeners.splice(0).forEach((remove) => remove())
    if (r.googletag && r.slot) r.googletag.destroySlots([r.slot])
    r.slot = undefined
  }

  const listen = <K extends keyof GoogletagEventMap>(
    r: Run,
    type: K,
    handler: (event: GoogletagEventMap[K]) => void,
  ) => {
    const pubads = r.googletag!.pubads()
    const listener = (event: GoogletagEventMap[K]) => {
      if (run === r && event.slot === r.slot) handler(event)
    }
    pubads.addEventListener(type, listener)
    r.removeListeners.push(() => pubads.removeEventListener(type, listener))
  }

  const begin = (r: Run, sessionId: string) => {
    const googletag = r.googletag!
    const slot = googletag.defineOutOfPageSlot(adUnitPath, googletag.enums.OutOfPageFormat.REWARDED)
    if (!slot) {
      set({ status: 'unavailable' })
      return
    }
    r.slot = slot
    listen(r, 'rewardedSlotReady', (event) => {
      if (state.status !== 'loading') return
      r.ready = event
      set({ status: 'ready' })
    })
    listen(r, 'rewardedSlotGranted', () => {
      if (r.grantRequested) return
      r.grantRequested = true
      set({ status: 'granting' })
      api.grant(sessionId).then(
        (grant) => {
          if (run === r) set({ status: 'rewarded', grant })
        },
        (error: unknown) => {
          if (run === r) set(failure(error))
        },
      )
    })
    listen(r, 'rewardedSlotClosed', () => {
      destroySlot(r)
      if (!r.grantRequested) set({ status: 'forfeited' })
    })
    listen(r, 'slotRenderEnded', (event) => {
      if (!event.isEmpty || state.status !== 'loading') return
      destroySlot(r)
      set({ status: 'unavailable' })
    })
    slot.addService(googletag.pubads())
    googletag.enableServices()
    googletag.display(slot)
  }

  return {
    getState: () => state,
    subscribe(listener) {
      subscribers.add(listener)
      return () => void subscribers.delete(listener)
    },
    start() {
      if (destroyed || !RESTARTABLE.has(state.status)) return
      if (run) destroySlot(run)
      const r: Run = { grantRequested: false, removeListeners: [] }
      run = r
      set({ status: 'opening' })
      const alive = () => !destroyed && run === r
      const open = async () => {
        let sessionId: string
        try {
          sessionId = (await api.openSession(purpose)).sessionId
        } catch (error) {
          if (alive()) set(failure(error))
          return
        }
        if (!alive()) return
        set({ status: 'loading' })
        try {
          r.googletag = await loadGoogletag()
        } catch (error) {
          if (alive()) set({ status: 'failed', error })
          return
        }
        if (!alive()) return
        r.googletag.cmd.push(() => {
          if (alive()) begin(r, sessionId)
        })
      }
      void open()
    },
    watch() {
      if (state.status !== 'ready' || !run?.ready || !isUserActive()) return
      if (run.ready.makeRewardedVisible()) set({ status: 'playing' })
    },
    cancel() {
      if (state.status !== 'ready' || !run) return
      destroySlot(run)
      run = null
      set({ status: 'idle' })
    },
    destroy() {
      destroyed = true
      if (run) destroySlot(run)
      run = null
      subscribers.clear()
    },
  }
}
