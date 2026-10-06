import type { AccountApi } from './account/accountApi'
import type { ReauthStore } from './reauth'
import { resolveReauthLanding, type ReauthLandingOutcome } from './reauthLanding'

/**
 * 본인 확인 링크는 메일에서 **새 탭**으로 열려 하려던 작업을 기억하는 탭(sessionStorage 는 탭마다 따로)과 다르다.
 * 도착 화면(새 탭)이 토큰을 같은 브라우저의 다른 탭에 「제안」하고, 하려던 작업이 있는 탭이 「받았다」고 답하면 그 탭이 이어 간다.
 * 답이 없으면(탭을 닫았다 · 다른 기기) 도착 화면이 토큰을 직접 보관한다.
 */
export type ReauthChannel = {
  /** 다른 탭에 토큰을 제안한다 — 누군가 받으면 true, 제한 시간 안에 답이 없거나 아무도 안 받으면 false */
  offer(token: string, timeoutMs: number): Promise<boolean>
  /** 제안을 받을 탭의 처리기 — 받으면 true(= 이 탭이 이어 간다). 해제 함수를 돌려준다 */
  onOffer(handler: (token: string) => boolean): () => void
  close?(): void
}

type BroadcastLike = {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  close(): void
}
type BroadcastFactory = new (name: string) => BroadcastLike

type Wire = { t: 'offer'; id: string; token: string } | { t: 'ack'; id: string }

/** 브라우저의 `BroadcastChannel`(같은 출처 · 같은 브라우저 프로필의 탭끼리). 없는 환경(서버 · 아주 오래된 브라우저)에서는 null */
export function createBroadcastReauthChannel(
  name = 'skeleton.reauth',
  Factory: BroadcastFactory | undefined = (globalThis as { BroadcastChannel?: BroadcastFactory })
    .BroadcastChannel,
): (ReauthChannel & { close(): void }) | null {
  if (!Factory) return null
  const channel = new Factory(name)
  let counter = 0
  return {
    offer(token, timeoutMs) {
      const id = `${Date.now()}-${++counter}-${Math.random().toString(36).slice(2)}`
      return new Promise<boolean>((done) => {
        const listener = (event: { data: unknown }) => {
          const message = event.data as Wire
          if (message?.t === 'ack' && message.id === id) finish(true)
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
      const listener = (event: { data: unknown }) => {
        const message = event.data as Wire
        if (message?.t === 'offer' && handler(message.token))
          channel.postMessage({ t: 'ack', id: message.id } satisfies Wire)
      }
      channel.addEventListener('message', listener)
      return () => channel.removeEventListener('message', listener)
    },
    close: () => channel.close(),
  }
}

/** 같은 프로세스 안의 채널 묶음 — 테스트용(탭 둘을 흉내 낸다) */
export function createReauthChannelHub(): { open(): ReauthChannel } {
  const handlers = new Map<object, (token: string) => boolean>()
  return {
    open() {
      const self = {}
      return {
        offer: (token, timeoutMs) =>
          new Promise<boolean>((done) => {
            const accepted = [...handlers.entries()].some(
              ([owner, handler]) => owner !== self && handler(token),
            )
            if (accepted) done(true)
            else setTimeout(() => done(false), timeoutMs)
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
  return channel.onOffer((token) => {
    if (!store.pending()) return false
    void resolveReauthLanding({ token, store, accountApi }).then(onOutcome)
    return true
  })
}

let shared: ReauthChannel | null | undefined

/** 이 브라우저 탭이 쓰는 채널 하나(브라우저에서만 — 서버 렌더에서는 열지 않는다) */
export function browserReauthChannel(): ReauthChannel | null {
  if (typeof window === 'undefined') return null
  if (shared === undefined) shared = createBroadcastReauthChannel()
  return shared
}
