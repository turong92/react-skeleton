import type { AccountApi } from './account/accountApi'
import type { ReauthStore } from './reauth'
import { resolveReauthLanding, type ReauthLandingOutcome } from './reauthLanding'

/**
 * 본인 확인 링크는 메일에서 **새 탭**으로 열려 하려던 작업을 기억하는 탭(sessionStorage 는 탭마다 따로)과 다르다.
 * 도착 화면(새 탭)이 토큰을 같은 브라우저의 다른 탭에 「제안」하면 받을 수 있는 탭이 「내가 하겠다」(claim)고 답하고,
 * 제안한 탭이 **첫 번째** claim 에만 「맡긴다」(grant)고 답한다 — 하려던 작업이 있는 탭이 둘이어도 토큰은 한 번만 쓰인다.
 * 답이 없으면(탭을 닫았다 · 다른 기기) 도착 화면이 토큰을 직접 보관한다.
 */
export type ReauthChannel = {
  /** 다른 탭에 토큰을 제안한다 — 한 탭이 맡았으면 true, 제한 시간 안에 아무도 안 맡으면 false */
  offer(token: string, timeoutMs: number): Promise<boolean>
  /** 제안을 받을 탭의 처리기. `claim()` 이 true 면 맡겠다는 뜻이고, 맡겨졌을 때만 `take(token)` 이 불린다. 해제 함수를 돌려준다 */
  onOffer(handler: ReauthOfferHandler): () => void
  close?(): void
}

export type ReauthOfferHandler = {
  claim(): boolean
  take(token: string): void
}

type BroadcastLike = {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  close(): void
}
type BroadcastFactory = new (name: string) => BroadcastLike

type Wire =
  | { t: 'offer'; id: string; token: string }
  | { t: 'claim'; id: string; taker: string }
  | { t: 'grant'; id: string; taker: string }

const randomId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** 브라우저의 `BroadcastChannel`(같은 출처 · 같은 브라우저 프로필의 탭끼리). 없는 환경(서버 · 아주 오래된 브라우저)에서는 null. 채널은 앱이 만들어 넘긴다(모듈 전역 없음) */
export function createBroadcastReauthChannel(
  name = 'skeleton.reauth',
  Factory: BroadcastFactory | undefined = (globalThis as { BroadcastChannel?: BroadcastFactory })
    .BroadcastChannel,
): (ReauthChannel & { close(): void }) | null {
  if (!Factory) return null
  const channel = new Factory(name)
  return {
    offer(token, timeoutMs) {
      const id = randomId()
      return new Promise<boolean>((done) => {
        const listener = (event: { data: unknown }) => {
          const message = event.data as Wire
          if (message?.t !== 'claim' || message.id !== id) return
          channel.postMessage({ t: 'grant', id, taker: message.taker } satisfies Wire)
          finish(true) // 첫 claim 만 — 이미 끝났으면 listener 가 없다
        }
        const timer = setTimeout(() => finish(false), timeoutMs)
        function finish(result: boolean) {
          clearTimeout(timer)
          channel.removeEventListener('message', listener)
          done(result)
        }
        channel.addEventListener('message', listener)
        channel.postMessage({ t: 'offer', id, token } satisfies Wire)
      })
    },
    onOffer(handler) {
      const me = randomId()
      const waiting = new Map<string, string>()
      const listener = (event: { data: unknown }) => {
        const message = event.data as Wire
        if (message?.t === 'offer' && handler.claim()) {
          waiting.set(message.id, message.token)
          channel.postMessage({ t: 'claim', id: message.id, taker: me } satisfies Wire)
        } else if (message?.t === 'grant' && message.taker === me) {
          const token = waiting.get(message.id)
          waiting.delete(message.id)
          if (token !== undefined) handler.take(token)
        }
      }
      channel.addEventListener('message', listener)
      return () => channel.removeEventListener('message', listener)
    },
    close: () => channel.close(),
  }
}

/** 같은 프로세스 안의 채널 묶음 — 테스트 · 스토리용(탭 둘을 흉내 낸다). 첫 claim 한 쪽만 맡는다 */
export function createReauthChannelHub(): { open(): ReauthChannel } {
  const handlers = new Map<object, ReauthOfferHandler>()
  return {
    open() {
      const self = {}
      return {
        offer: (token, timeoutMs) =>
          new Promise<boolean>((done) => {
            const taker = [...handlers.entries()].find(
              ([owner, handler]) => owner !== self && handler.claim(),
            )
            if (taker) {
              taker[1].take(token)
              done(true)
            } else setTimeout(() => done(false), timeoutMs)
          }),
        onOffer(handler) {
          handlers.set(self, handler)
          return () => void handlers.delete(self)
        },
      }
    },
  }
}

/**
 * 하려던 작업이 있는 탭이 건다 — 다른 탭의 제안을 받아 그 작업을 이어 간다(작업이 없는 탭은 받지 않는다).
 * 해제 함수를 돌려준다.
 */
export function listenForReauthToken({
  channel,
  store,
  accountApi,
  onOutcome,
}: {
  channel: ReauthChannel
  store: ReauthStore
  accountApi: Pick<AccountApi, 'changeEmail'>
  onOutcome: (outcome: ReauthLandingOutcome) => void
}): () => void {
  return channel.onOffer({
    claim: () => store.pending() !== null,
    take: (token) => void resolveReauthLanding({ token, store, accountApi }).then(onOutcome),
  })
}
