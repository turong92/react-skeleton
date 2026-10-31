# @skeleton/push

웹 푸시 — 브라우저가 앱을 닫아 둬도 새 알림을 받게 한다. 앱 안 띠(`PushPrompt`) → 클릭 안에서 권한 · 구독 · 서버 등록(`usePush`), 로그인 뒤 · 창이 보일 때 구독 맞추기(`usePushSync`), 로그아웃 직전 해지(`unregisterPush`), 설정 칸(`PushSettings`), 서비스 워커를 내는 Vite 플러그인(`@skeleton/push/vite`).
의존: `@skeleton/api-client` · `@skeleton/time`(`formatInstant`) · `@skeleton/ui`. peer: `react` `@tanstack/react-query`(앱에 `sonner` 도 — `ui` 가 쓴다). Firebase JS SDK 는 쓰지 않는다 — 표준 Web Push(VAPID)만이라 모든 브라우저가 한 길이다.

## 어느 백엔드와 짝인가

| 쓰는 것             | 백엔드                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 발송 · 기기 저장소  | `notification-push` + `notification-push-jdbc` + `notification-webpush`(VAPID · 암호화). 모바일 앱 토큰은 `notification-fcm`(이 패키지는 브라우저 화면만)                                                                      |
| **HTTP 엔드포인트** | 모듈이 연다(서블릿 앱 + Spring Security, 모두 인증 · 호출자 = `Authentication.name`): `GET /api/v1/push/config` · `…/devices` · `PUT/DELETE …/devices/{installationId}` · `POST …/devices/{id}/test` · `GET/PUT …/preferences` |
| 알림 원본           | 푸시는 `NotificationPublisher.publish` 한 알림이 받는 사람의 기기로도 가는 **채널**이다. 알림함(`@skeleton/notifications`)이 원본이고 푸시는 최선 노력이다                                                                     |

`GET /config` 의 `webPush.publicKey` 로 구독하고, 기기는 `installationId`(이 브라우저가 한 번 만든 무작위 값, 서버에서 한 설치 = 한 줄)로 `PUT`(=등록 겸 갱신)한다.

## 쓰는 법

```ts
// vite.config.ts — 의존 없는 서비스 워커 한 장을 빌드 뿌리에 낸다(개발 서버도 같은 주소, base 를 따른다)
import { pushServiceWorker } from '@skeleton/push/vite'
export default defineConfig({ plugins: [react(), pushServiceWorker({ icon: '/icon-192.png' })] })
```

```tsx
// src/push/api.ts — 앱이 한 번 만든다
export const pushApi = createPushApi(apiClient /*, { basePath: '/push' }*/)

// 로그인한 화면에서 한 번 — 로그인 뒤와 창이 다시 보일 때 서버와 브라우저를 맞춘다(권한은 묻지 않는다)
usePushSync(pushApi, { accountId })

// 앱 안 띠 — 언제 띄울지는 앱이 정한다(예: 첫 노트를 저장한 뒤). 「알림 받기」 클릭 안에서 권한을 묻는다
<PushPrompt api={pushApi} accountId={accountId} open={savedFirstNote} />

// 설정 화면(카드 안) — 이 기기 스위치 · 시험 알림 · 내 다른 기기 · 종류별 스위치
<PushSettings api={pushApi} accountId={accountId} labels={koPushLabels} />

// 로그아웃 — 토큰을 지우기 **전에** 기다린다(인증이 필요한 호출이다). 실패해도 던지지 않는다
await unregisterPush(pushApi)
clearTokens()
```

옵션(`usePush` · `usePushSync` · `PushPrompt` · `PushSettings` 가 같이 받는다): `accountId`(필수) · `serviceWorkerUrl`(기본 `/push-sw.js` — `base` 를 쓰는 앱은 맞춰 준다) · `deviceLabel`(서버의 「내 기기」 표에 보일 이름) · `env` · `storage`(시험 · 스토리용).

## 약속 (깨지면 사고 나는 것)

- **권한은 클릭 안에서만 묻는다.** `enable()` 만 `Notification.requestPermission()` 을 부르고, `usePushSync` · 마운트 · 효과는 절대 묻지 않는다. 띠(`PushPrompt`) 없이도 `enable()` 은 `onClick` 에서만 부른다. 거절(`denied`)이면 다시 묻지 않는다 — 설정 칸이 브라우저 설정에서 허용하는 법을 안내한다.
- **켬 표시는 계정별** 로 브라우저 저장소에 둔다(`skeleton.push.enabled.<accountId>`). 공용 PC 에서 다른 사람이 로그인해도 자동으로 켜지지 않는다.
- **키가 바뀌면 다시 구독한다.** `usePushSync` 는 구독이 없거나 서버의 공개 키와 다르면 옛 구독을 지우고 새로 만들어 `PUT` 한다(VAPID 키를 바꾸면 모든 웹 구독이 다음 방문까지 끊긴다).
- **권한이 `denied` 로 바뀌었으면** 서버의 이 기기를 `DELETE` 하고 켬 표시를 거둔다(푸시 서버로 계속 보내지 않는다).
- **로그아웃이 막히지 않는다.** `unregisterPush` 는 `DELETE` 가 끝난 뒤 돌아오고, 실패해도 던지지 않는다(서버는 세션이 끊길 때 그 세션의 기기도 정리한다).
- **서비스 워커는 늘 알림을 띄운다**(Chrome `userVisibleOnly` — 안 띄우면 기본 문구를 대신 띄운다). 알림을 눌렀을 때 `link` 는 `/` 로 시작하고 `//` · `\` · 제어 문자가 없는 앱 안 경로일 때만 따라간다(아니면 앱 첫 화면). `pushsubscriptionchange` 는 다루지 않는다(워커에는 로그인이 없다 — 다음 `usePushSync` 가 고친다).
- iOS(16.4+)는 홈 화면에 추가한 앱에서만 된다(`pushSupport()` → `needs-install`). 서비스 워커 · `PushManager` · `Notification` 중 없으면 `unsupported`.

## 공개 표면

| export                                                               | 뜻                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createPushApi(client, { basePath? })`                               | `config()` · `devices()` · `registerDevice(id, body)` · `removeDevice(id)` · `sendTest(id)` · `preferences()` · `setPreference(type, enabled)` — `client` 는 `Pick<ApiClient, 'value' \| 'noContent'>` |
| `getInstallationId(storage)`                                         | 이 브라우저의 기기 id(저장소에 한 번 만든다)                                                                                                                                                           |
| `pushSupport()`                                                      | `supported` \| `needs-install` \| `unsupported`                                                                                                                                                        |
| `usePush(api, options)`                                              | `{ support, permission, enabled, installationId, busy, failed, enable(), disable(), sendTest() }` — 브라우저를 재기 전(서버 렌더)에는 `support` · `permission` 이 null                                 |
| `usePushSync(api, options)`                                          | 로그인 뒤 · 창이 보일 때 구독 맞추기(조용히 실패)                                                                                                                                                      |
| `unregisterPush(api, { storage? })`                                  | 로그아웃 직전 해지                                                                                                                                                                                     |
| `PushPrompt`                                                         | 앱 안 띠(`open` · `snoozeDays` 14 · `labels`) — 지원됨 · 권한 `default` · 쉬는 중 아님 · 서버가 웹 푸시를 켬일 때만 보인다                                                                             |
| `PushSettings`                                                       | 설정 칸 — 이 기기 스위치 · 상태 안내 · 시험 알림 · 내 다른 기기 표(지우기) · 종류별 스위치(`allChannelsMuted` 면 잠금 + 까닭). 광고 종류는 여기 없다                                                   |
| `usePushConfig` · `usePushDevices` · `usePushPreferences`            | 쿼리 훅(`pushKeys` · `configQuery` · `devicesQuery` · `preferencesQuery` 는 키 + 함수)                                                                                                                 |
| `useRemovePushDevice` · `useSetPushPreference`                       | 기기 지우기 · 종류별 푸시 끄기/켜기(서버가 돌려준 값으로 캐시를 고친다)                                                                                                                                |
| `defaultPushLabels` · `koPushLabels` · `resolvePushLabels(partial?)` | 문구 모음(영어 기본 · 한국어). 종류 이름은 `labels.settings.types.names` 로 번역해 넘긴다                                                                                                              |
| `@skeleton/push/vite` → `pushServiceWorker({ fileName?, icon? })`    | Vite 플러그인(vite 를 import 하지 않는다) — 빌드 뿌리에 `push-sw.js`, 개발 서버는 같은 주소                                                                                                            |

## 스토리 · 시험

`PushPrompt`(보임 · 「나중에」 · 쉼) · `PushSettings`(꺼짐 → 켜기 → 시험 · 다른 기기 지우기 · 끄기 · 거절됨 · 홈 화면 추가 필요 · 미지원 · 서버가 웹 푸시를 안 켬 · 종류 스위치 · 전체 꺼짐으로 잠긴 종류)가 `play` 로 돈다. 브라우저는 `src/test/fakePush.ts` 의 가짜 환경(`fakePushEnv` · `fakePushApi`)으로 바꾼다. 서비스 워커는 소스를 가짜 `self` 로 실제 실행해 시험한다(`serviceWorker.test.ts`).

## 하지 않는 것

- 광고 푸시 수신 동의 화면 — 다음 조각(`@skeleton/push/advertising`).
- 모바일 앱 푸시 — 앱(안드로이드 · iOS)이 FCM 토큰을 같은 `PUT /push/devices/{id}` 로 등록한다(백엔드 `docs/push-http-contract.md`).
- 알림 단추(actions) · 이미지 · 앞 창 중복 억제 · 기기 이름 바꾸기.
