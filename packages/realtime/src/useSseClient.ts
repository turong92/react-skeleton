import { useCallback, useEffect, useRef, useState } from 'react'
import { createSseClient, type SseClientOptions } from './createSseClient'
import type { SseEvent } from './sseStream'
import type { RealtimeStatus } from './types'

export type UseSseClientOptions = Omit<SseClientOptions, 'onEvent'> & {
  onEvent?: SseClientOptions['onEvent']
  /** 화면에 들고 있을 최근 이벤트 수(기본 20) */
  maxEvents?: number
}

/**
 * `createSseClient` 를 컴포넌트 수명에 묶는다. 렌더마다 최신 옵션을 읽으므로 토큰 · traceId 가 바뀌어도 다음 (재)연결부터 따라간다.
 * `reconnect` · `fetch` 는 처음 값으로 고정된다. 마운트만으로는 연결하지 않는다 — `start()` 를 부른다. 언마운트하면 끊는다.
 */
export function useSseClient(options: UseSseClientOptions) {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })
  const latest = useCallback(() => optionsRef.current, [])
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [events, setEvents] = useState<SseEvent[]>([])

  // eslint-disable-next-line react-hooks/refs -- 옵션은 콜백이 불릴 때(이벤트 · 타이머) 읽는다. 렌더 중에 읽지 않는다
  const [client] = useState(() =>
    createSseClient({
      url: () => resolve(latest().url),
      getAuthHeaders: () => latest().getAuthHeaders?.(),
      traceId: () => resolve(latest().traceId),
      reconnect: options.reconnect,
      fetch: options.fetch,
      onEvent: (event) => {
        latest().onEvent?.(event)
        const limit = latest().maxEvents ?? 20
        setEvents((current) => [event, ...current].slice(0, limit))
      },
      onStatus: (next) => {
        setStatus(next)
        latest().onStatus?.(next)
      },
      onResponse: (info) => latest().onResponse?.(info),
      onError: (error) => latest().onError?.(error),
    }),
  )

  useEffect(() => () => client.stop(), [client])

  const start = useCallback(() => {
    setEvents([])
    return client.start()
  }, [client])
  const stop = useCallback(() => client.stop(), [client])

  return { status, events, start, stop }
}

function resolve<T>(value: T | (() => T)): T {
  return typeof value === 'function' ? (value as () => T)() : value
}
