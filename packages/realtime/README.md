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

### SSE 하드닝

- **탭 가시성**: 탭이 숨겨지면 연결을 끊고 `paused`, 보이면 곧바로 다시 잇는다(백오프 없이). 숨긴 채 시작하면 보일 때까지 연결하지 않는다. 기본 소스는 `document.visibilityState`(`documentVisibility()`), `visibility: { hidden, subscribe }` 로 갈아 끼운다.
- **유휴 시간 초과**: `idleTimeoutMs` 를 주면 그 시간 동안 바이트(심장박동 주석 포함)가 없을 때 끊고 다시 잇는다. **기본은 꺼짐** — 서버가 심장박동을 보내는 주기보다 길게(예: 주기의 3배) 줄 때만 켠다.
- **영구 중지**: 401 · 403 · 404 는 `off` 로 멈추고 다시 시도하지 않는다(토큰이 틀렸거나 기능이 꺼졌다). 로그인 · 설정이 바뀐 뒤 `start()` 하면 다시 시도한다.
- **느린 재시도**: 429 · 503 은 일반 백오프 대신 `busyDelayMs`(기본 30초) 뒤에, `Retry-After`(초 또는 HTTP 날짜)가 더 길면 그만큼(`maxRetryAfterMs` 상한, 기본 5분) 기다린다. 그 밖의 오류는 기존 재연결 정책.
- **`onOpen({ reconnect })`**: 열릴 때마다. `reconnect: true` 면 그 사이(끊김 · 숨김) 놓친 사건이 있을 수 있어 목록을 다시 읽는다. `stop()` 뒤 `start()` 는 새 세션이라 `false`.

## 공개 표면

| export                                                                                                                                                                                     | 뜻                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSseClient({ url, getAuthHeaders?, traceId?, onEvent, onStatus?, onOpen?, onResponse?, onError?, reconnect?, idleTimeoutMs?, busyDelayMs?, maxRetryAfterMs?, visibility?, fetch? })` | fetch 스트리밍 SSE(헤더를 보낼 수 있어 `EventSource` 를 쓰지 않는다). `{ start(), stop(), getStatus() }`                                                                                                                           |
| `createStompNotificationClient({ url, getAccessToken, topic?, traceId?, onMessage, onStatus?, onDiagnostic?, reconnect?, webSocketFactory?, protocols? })`                                 | CONNECT · SUBSCRIBE · DISCONNECT 프레임 + 재연결. `onDiagnostic` 은 `blocked` · `socket-open` · `stomp-error` · `socket-error` · `exception`                                                                                       |
| `useSseClient` · `useNotificationSocket`                                                                                                                                                   | 위 클라이언트의 얇은 React 훅                                                                                                                                                                                                      |
| `reconnect`                                                                                                                                                                                | `NotificationReconnectPolicy { initialDelayMs, maxDelayMs, multiplier, maxAttempts? }`(기본 1s → 15s 두 배) 또는 `false`                                                                                                           |
| `RealtimeStatus`                                                                                                                                                                           | `idle` · `connecting` · `reconnecting` · `open` · `error` · `paused` · `off` (바뀔 때만 보고; `paused` · `off` 는 SSE 만)                                                                                                          |
| 저수준                                                                                                                                                                                     | `parseSseBlock` `readSseStream` · `encodeStompFrame` `parseStompFrames` `websocketUrlFromApiBase` · `createNotification*Frame(s)` `parseNotificationMessage` · `nextNotificationReconnectDelay` `shouldRetryNotificationReconnect` |
