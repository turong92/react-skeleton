# @skeleton/notifications

알림 받은편지함 — 목록(페이지) · 읽음 · 모두 읽음 + TanStack Query 훅 + 안 읽은 수(전용 엔드포인트, 실시간으로 갱신) + 줄 링크 · 묶인 줄의 수 + 종류별 수신 설정 + `NotificationBell`/`NotificationList`/`NotificationPreferences`.
의존: `@skeleton/api-client` · `@skeleton/time`(`formatInstant`) · `@skeleton/ui`. peer: `react` `@tanstack/react-query`(앱에 `sonner` 도 — `ui` 가 쓴다). `@skeleton/realtime` 에는 의존하지 않는다 — 이벤트를 받는 함수(`ingest`)를 건네줄 뿐이다.

## 어느 백엔드와 짝인가

| 쓰는 것                   | 백엔드                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 받은편지함 저장소(재사용) | `modules/notification`(`NotificationInboxRepository`) + `notification-jdbc`(영속)                                                                                                                                                                                                                                                                                                                        |
| **HTTP 엔드포인트**       | **`modules/notification` 이 연다**(서블릿 앱 + Spring Security — 인증 필수, 호출자 = `Authentication.name`): `GET /api/v1/notifications` · `GET …/unread-count` · `PATCH …/{eventId}/read` · `PATCH …/read-all` · `GET …/preferences` · `PUT …/preferences/{type}`. 기본 경로가 이 패키지의 기본값이다. 앱이 자기 컨트롤러를 두면(`skeleton.notification.inbox.enabled=false`) 경로가 다를 때 `basePath` |
| 실시간 이벤트             | `notification-sse`(`/api/v1/notifications/sse`) · `notification-websocket` → `@skeleton/realtime`                                                                                                                                                                                                                                                                                                        |

`GET` 은 백엔드 `PageQuery`(`page` 0 부터 · `size` 1..100) + `unreadOnly` · `topic`, 응답은 페이지 envelope(`{ values, pagination, meta }`). 안 읽은 수는 **전용 엔드포인트** `GET …/unread-count`(`{ value: { count } }`)로 읽는다. 목록 줄에는 `link`(앱 안 경로 또는 null)와 `collapsedCount`(같은 열쇠로 묶인 수)가 있다.

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

`ingest` 는 객체나 JSON 글자를 받고, 알림이 아닌 것(SSE 의 `connected` 이벤트)은 무시하고, 같은 이벤트 id 는 한 번만 센다(재연결 재전송). 이벤트에 `collapseKey` 가 있으면 서버가 안 읽은 같은 줄에 접었을 수 있어 안 읽은 수를 +1 하지 않고 다시 읽는다.

### 줄을 눌러 이동하기 · 종류별 끄기

```tsx
// 링크 있는 줄의 제목이 밑줄 링크가 되고, 누르면 읽음 + 대화상자 닫기 + onOpen — 이동은 앱이 라우터로
<NotificationBell api={notificationsApi} onOpen={(item) => item.link && navigate(item.link)} />

// 설정 화면 — 서버가 알려 준 종류마다 스위치(켜짐 = 받는다). 이름은 labels 로 번역해 넘긴다
<NotificationPreferences api={notificationsApi} labels={{ NOTE_UPDATED: t('…'), 'comment.created': t('…') }} />
```

링크는 **앱 안 경로만** 따라간다 — `/` 로 시작하고 `//` 로 시작하지 않는 것(서버도 같은 규칙으로 막고, 이 패키지가 한 번 더 확인해 아니면 글자로만 보인다). 끌 수 있는 종류는 백엔드 `skeleton.notification.preferences.types` 가 정한다 — 비면 `NotificationPreferences` 는 빈 상태를 그린다.
`describe` 가 `ReactNode` 제목을 돌려주면 읽음 단추의 낭독 이름은 서버 제목(`title ?? type`)으로 남는다. 링크를 수정키(Ctrl · Cmd · Shift · Alt)나 가운데 단추로 누르면 브라우저가 새 탭 등으로 열 뿐 `onOpen` 도 읽음 처리도 하지 않는다.
SSE 심장박동(백엔드 `notification-sse` 의 `heartbeat`)을 켰다면 `useSseClient({ idleTimeoutMs })` 를 그 3배쯤으로 건다(견본: 15초 → 45초).

## 공개 표면

| export                                                                                                                       | 뜻                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createNotificationsApi(client, { basePath? })`                                                                              | `list(params)` · `markRead(eventId)` · `markAllRead()` · `unreadCount()` · `preferences()` · `setPreference(type, muted)` — `client` 는 `Pick<ApiClient, 'page' \| 'value'>`                                                 |
| `notificationKeys` · `notificationListQuery(api, params)` · `unreadCountQuery(api)` · `preferencesQuery(api)`                | 쿼리 정의(키 + 함수) — 훅과 따로 두어 테스트 · `prefetch` 에 쓴다                                                                                                                                                            |
| `useNotifications(api, params, { enabled })` · `useUnreadCount(api)`                                                         | 목록 한 쪽(이전 쪽을 보여 주며 새로 가져옴) · 안 읽은 수                                                                                                                                                                     |
| `usePreferences(api)` · `useSetPreference(api)`                                                                              | 종류별 수신 설정 목록 · 한 종류 끄기/켜기(성공하면 서버가 돌려준 값으로 캐시를 고친다)                                                                                                                                       |
| `useMarkRead(api)` · `useMarkAllRead(api)`                                                                                   | 성공하면 캐시를 바로 고친다(`applyRead` · `applyReadAll`). 에러 토스트는 앱의 QueryClient 전역 핸들러                                                                                                                        |
| `useNotificationIngest(options?)` · `createInboxSync(queryClient, options?)`                                                 | 실시간 이벤트 → 캐시(`ingest(payload): boolean`). `onNotification` 으로 토스트 등                                                                                                                                            |
| `parseNotificationEvent(raw)`                                                                                                | 객체/JSON → `NotificationEvent \| null`                                                                                                                                                                                      |
| `<NotificationBell api pageSize bellLabel title closeLabel markAllReadLabel onOpen describe collapsedLabel listProps … />`   | 종 버튼 + 배지(99+) + 누르면 받은편지함 `<dialog>`(포커스 가두기 · Esc). `onOpen`(링크 줄 제목을 누르면 읽음 + 닫기 + 호출) · `describe` · `collapsedLabel` 은 목록에 그대로 넘긴다. 문구는 전부 prop(기본 영어)             |
| `<NotificationList items onRead onOpen describe collapsedLabel formatTime markReadLabel emptyTitle severityLabels />`        | 보이기만 하는 목록. 안 읽은 줄 `data-unread`, 심각도 `data-severity`. `onOpen` 이 있고 `link` 가 앱 안 경로면 제목이 밑줄 `<a href>`, `describe` 로 제목 · 내용을 앱이 다시 정함, `collapsedCount > 1` 이면 수 배지          |
| `<NotificationPreferences api labels descriptions title loadingLabel emptyTitle errorMessage retryLabel saveErrorMessage />` | 종류별 수신 설정 — `SwitchRow` 목록(즉시 저장). 로딩 `Spinner`, 종류가 없으면 `EmptyState`, 불러오기 실패는 오류 띠 + `retryLabel` 단추, 저장 실패는 목록 위 `saveErrorMessage` 한 줄, 저장 중인 줄마다 `busy`               |
| 타입                                                                                                                         | `NotificationItem`(= `NotificationInboxItemResponse`, `link` · `collapsedCount` 포함) · `NotificationEvent`(= Kotlin `NotificationEvent`, `link` · `collapseKey` 포함) · `NotificationPreference` · `NotificationSeverity` … |

## 테스트가 재지 않는 것

TanStack Query 의 캐시 규칙(`applyRead` · `ingest` — 실제 `QueryClient`), API 경로 · 파라미터, 목록/종 마크업(`renderToStaticMarkup`)은 잰다. **재지 않는다**: 종을 눌러 대화상자가 열리고 첫 쪽을 가져오는 흐름, 읽음 버튼 클릭 → 캐시 반영의 React 배선(훅 안의 `useMutation`), 실제 SSE/STOMP 연결. 앱에서 한 번 눌러 확인한다(workbench `/packages` 화면이 같은 컴포넌트를 쓴다).
