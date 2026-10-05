import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createStompNotificationClient,
  type StompNotificationClientOptions,
} from './createStompNotificationClient'
import type { NotificationStompMessage } from './notificationStompSession'
import type { RealtimeStatus } from './types'

export type UseNotificationSocketOptions = Omit<StompNotificationClientOptions, 'onMessage'> & {
  onMessage?: StompNotificationClientOptions['onMessage']
  /** 화면에 들고 있을 최근 메시지 수(기본 20) */
  maxEvents?: number
}

/** `createStompNotificationClient` 를 컴포넌트 수명에 묶는다 — `useSseClient` 와 같은 규칙(`topic` · `reconnect` · `webSocketFactory` · `protocols` 는 처음 값으로 고정)(마운트만으로 연결하지 않고, 언마운트하면 끊는다) */
export function useNotificationSocket(options: UseNotificationSocketOptions) {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })
  const latest = useCallback(() => optionsRef.current, [])
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [messages, setMessages] = useState<NotificationStompMessage[]>([])

  // eslint-disable-next-line react-hooks/refs -- 옵션은 콜백이 불릴 때(이벤트 · 타이머) 읽는다. 렌더 중에 읽지 않는다
  const [client] = useState(() =>
    createStompNotificationClient({
      url: () => resolve(latest().url),
      topic: options.topic,
      getAccessToken: () => latest().getAccessToken(),
      traceId: () => resolve(latest().traceId),
      reconnect: options.reconnect,
      webSocketFactory: options.webSocketFactory,
      protocols: options.protocols,
      onMessage: (message) => {
        latest().onMessage?.(message)
        const limit = latest().maxEvents ?? 20
        setMessages((current) => [message, ...current].slice(0, limit))
      },
      onStatus: (next) => {
        setStatus(next)
        latest().onStatus?.(next)
      },
      onDiagnostic: (diagnostic) => latest().onDiagnostic?.(diagnostic),
    }),
  )

  useEffect(() => () => client.stop(), [client])

  const start = useCallback(() => {
    setMessages([])
    client.start()
  }, [client])
  const stop = useCallback(() => client.stop(), [client])

  return { status, messages, start, stop }
}

function resolve<T>(value: T | (() => T)): T {
  return typeof value === 'function' ? (value as () => T)() : value
}
