# @skeleton/notifications

알림 받은편지함 — 목록(페이지) · 읽음 · 모두 읽음 + TanStack Query 훅 + 안 읽은 수(실시간으로 갱신) + `NotificationBell`/`NotificationList`.
의존: `@skeleton/api-client` · `@skeleton/time`(`formatInstant`) · `@skeleton/ui`. peer: `react` `@tanstack/react-query`(앱에 `sonner` 도 — `ui` 가 쓴다). `@skeleton/realtime` 에는 의존하지 않는다 — 이벤트를 받는 함수(`ingest`)를 건네줄 뿐이다.

## 어느 백엔드와 짝인가

| 쓰는 것                   | 백엔드                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 받은편지함 저장소(재사용) | `modules/notification`(`NotificationInboxRepository`) + `notification-jdbc`(영속)                                                                                                                              |
| **HTTP 엔드포인트**       | **모듈에 없다.** `apps/workbench` 의 `NotificationInboxController`(`GET /api/v1/notifications` · `PATCH …/{eventId}/read` · `PATCH …/read-all`) — 데모다. 내 앱이 같은 모양으로 열고, 경로가 다르면 `basePath` |
| 실시간 이벤트             | `notification-sse`(`/api/v1/notifications/sse`) · `notification-websocket` → `@skeleton/realtime`                                                                                                              |

`GET` 은 백엔드 `PageQuery`(`page` 0 부터 · `size` 1..100) + `unreadOnly` · `topic`, 응답은 페이지 envelope(`{ values, pagination, meta }`). 안 읽은 수는 **전용 엔드포인트가 없어서** `unreadOnly=true&size=1` 의 `pagination.totalElements` 로 센다.

## 쓰는 법

```tsx
// src/notifications/api.ts — 앱이 한 번 만든다
export const notificationsApi = createNotificationsApi(apiClient /*, { basePath: '/notifications' }*/)

// 헤더에
<NotificationBell api={notificationsApi} />

// 실시간(선택): 같은 캐시를 갱신한다 — 안 읽은 수가 +1, 열린 목록은 다시 가져온다
const ingest = useNotificationIngest({ onNotification: (n) => toast(n.title ?? n.type) })
const sse = useSseClient({ url, getAuthHeaders, onEvent: (e) => ingest(e.data) })
const ws = useNotificationSocket({ url, getAccessToken, onMessage: (m) => ingest(m.value) })
// 마운트 때 sse.start() — realtime 훅은 start 를 불러야 연결한다
```

`NotificationBell` 은 마운트하면 안 읽은 수를 가져온다 — 받은편지함은 로그인한 사람의 것이라 **로그인한 화면에서만 그린다**(비로그인이면 401 이 전역 에러 토스트로 간다).

`ingest` 는 객체나 JSON 글자를 받고, 알림이 아닌 것(SSE 의 `connected` 이벤트)은 무시하고, 같은 이벤트 id 는 한 번만 센다(재연결 재전송).

## 공개 표면

| export                                                                                      | 뜻                                                                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `createNotificationsApi(client, { basePath? })`                                             | `list(params)` · `markRead(eventId)` · `markAllRead()` — `client` 는 `Pick<ApiClient, 'page' \| 'value'>`                            |
| `notificationKeys` · `notificationListQuery(api, params)` · `unreadCountQuery(api)`         | 쿼리 정의(키 + 함수) — 훅과 따로 두어 테스트 · `prefetch` 에 쓴다                                                                    |
| `useNotifications(api, params, { enabled })` · `useUnreadCount(api)`                        | 목록 한 쪽(이전 쪽을 보여 주며 새로 가져옴) · 안 읽은 수                                                                             |
| `useMarkRead(api)` · `useMarkAllRead(api)`                                                  | 성공하면 캐시를 바로 고친다(`applyRead` · `applyReadAll`). 에러 토스트는 앱의 QueryClient 전역 핸들러                                |
| `useNotificationIngest(options?)` · `createInboxSync(queryClient, options?)`                | 실시간 이벤트 → 캐시(`ingest(payload): boolean`). `onNotification` 으로 토스트 등                                                    |
| `parseNotificationEvent(raw)`                                                               | 객체/JSON → `NotificationEvent \| null`                                                                                              |
| `<NotificationBell api pageSize bellLabel title closeLabel markAllReadLabel listProps … />` | 종 버튼 + 배지(99+) + 누르면 받은편지함 `<dialog>`(포커스 가두기 · Esc). 문구는 전부 prop(기본 영어)                                 |
| `<NotificationList items onRead formatTime markReadLabel emptyTitle severityLabels />`      | 보이기만 하는 목록. 안 읽은 줄 `data-unread`, 심각도 `data-severity`                                                                 |
| 타입                                                                                        | `NotificationItem`(= `NotificationInboxItemResponse`) · `NotificationEvent`(= Kotlin `NotificationEvent`) · `NotificationSeverity` … |

## 테스트가 재지 않는 것

TanStack Query 의 캐시 규칙(`applyRead` · `ingest` — 실제 `QueryClient`), API 경로 · 파라미터, 목록/종 마크업(`renderToStaticMarkup`)은 잰다. **재지 않는다**: 종을 눌러 대화상자가 열리고 첫 쪽을 가져오는 흐름, 읽음 버튼 클릭 → 캐시 반영의 React 배선(훅 안의 `useMutation`), 실제 SSE/STOMP 연결. 앱에서 한 번 눌러 확인한다(workbench `/packages` 화면이 같은 컴포넌트를 쓴다).
