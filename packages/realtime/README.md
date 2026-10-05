# @skeleton/realtime

실시간 알림 클라이언트 — 백엔드 `notification-sse`(`GET /notifications/sse`) · `notification-websocket`(STOMP `/ws/notifications`) 짝.
의존: `@skeleton/api-client`(traceparent). peer: `react`(훅만 쓰면).

```ts
const sse = createSseClient({
  url: () => apiClient.endpoint('/notifications/sse?topic=demo'),
  getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }), // 재연결마다 다시 읽는다
  onEvent: (event) => …, onStatus: (status) => …,
})
void sse.start(); sse.stop()

const socket = createStompNotificationClient({
  url: websocketUrlFromApiBase(baseUrl, '/ws/notifications'),
  getAccessToken: () => token, // WebSocket 은 bearer 토큰이 있어야 붙는다
  topic: 'demo', onMessage: (message) => …,
})
```

React 에서는 훅이 수명(언마운트 시 끊기)과 최근 목록을 맡는다. 마운트만으로 연결하지 않는다.

```tsx
const sse = useSseClient({ url, getAuthHeaders, maxEvents: 8 }) // { status, events, start, stop }
const ws = useNotificationSocket({ url, getAccessToken, topic: 'demo' }) // { status, messages, start, stop }
```

## 공개 표면

| export                                                                                                                                                     | 뜻                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSseClient({ url, getAuthHeaders?, traceId?, onEvent, onStatus?, onResponse?, onError?, reconnect?, fetch? })`                                       | fetch 스트리밍 SSE(헤더를 보낼 수 있어 `EventSource` 를 쓰지 않는다). `{ start(), stop(), getStatus() }`                                                                                                                           |
| `createStompNotificationClient({ url, getAccessToken, topic?, traceId?, onMessage, onStatus?, onDiagnostic?, reconnect?, webSocketFactory?, protocols? })` | CONNECT · SUBSCRIBE · DISCONNECT 프레임 + 재연결. `onDiagnostic` 은 `blocked` · `socket-open` · `stomp-error` · `socket-error` · `exception`                                                                                       |
| `useSseClient` · `useNotificationSocket`                                                                                                                   | 위 클라이언트의 얇은 React 훅                                                                                                                                                                                                      |
| `reconnect`                                                                                                                                                | `NotificationReconnectPolicy { initialDelayMs, maxDelayMs, multiplier, maxAttempts? }`(기본 1s → 15s 두 배) 또는 `false`                                                                                                           |
| `RealtimeStatus`                                                                                                                                           | `idle` · `connecting` · `reconnecting` · `open` · `error` (바뀔 때만 보고)                                                                                                                                                         |
| 저수준                                                                                                                                                     | `parseSseBlock` `readSseStream` · `encodeStompFrame` `parseStompFrames` `websocketUrlFromApiBase` · `createNotification*Frame(s)` `parseNotificationMessage` · `nextNotificationReconnectDelay` `shouldRetryNotificationReconnect` |
