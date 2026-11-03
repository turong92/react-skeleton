import { createSseClient, type SseClientOptions } from '@skeleton/realtime'
import { createEntryHeaders } from '@skeleton/waiting-room'
import type { SeatStreamConnect } from './seatFeed'

/** 서버가 15초마다 심장박동 주석을 보낸다 - 그 세 배 동안 바이트가 없으면 끊고 다시 붙는다 */
const IDLE_TIMEOUT_MS = 45_000

export type SeatStreamOptions = {
  url: string
  /** 대기실을 단 풀의 입장권(연결할 때마다 읽는다) */
  getEntryToken?: () => string | null | undefined
  /** 로그인 헤더 · 401 복구 등 - 알림 흐름을 붙일 때와 같은 것을 넘긴다 */
  sse?: Pick<
    SseClientOptions,
    | 'getAuthHeaders'
    | 'recoverUnauthorized'
    | 'subscribeAuthChanges'
    | 'traceId'
    | 'fetch'
    | 'visibility'
    | 'reconnect'
  >
}

/** `@skeleton/realtime` 의 SSE 클라이언트 위에 배치도 흐름을 올린다 - 열릴 때마다 `onOpen` 이 불려 피드가 스냅샷을 다시 읽는다 */
export function createSseConnector({
  url,
  getEntryToken,
  sse,
}: SeatStreamOptions): SeatStreamConnect {
  return (handlers) => {
    const client = createSseClient({
      ...sse,
      url,
      getAuthHeaders: () => ({
        ...sse?.getAuthHeaders?.(),
        ...createEntryHeaders(getEntryToken?.()),
      }),
      idleTimeoutMs: IDLE_TIMEOUT_MS,
      onOpen: () => handlers.onOpen(),
      onStatus: handlers.onStatus,
      onEvent: (event) => handlers.onEvent(event.name, event.data),
    })
    return {
      start: () => void client.start(),
      stop: () => client.stop(),
    }
  }
}
