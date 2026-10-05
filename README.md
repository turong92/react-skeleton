# react-skeleton

React + TypeScript + Vite 프론트엔드 스켈레톤 — **pnpm 워크스페이스**. Kotlin modular skeleton 백엔드(`modules/`)와 같은 방식으로, 프로젝트가 필요한 조각만 한 줄씩 골라 쓴다.

```
apps/
├── starter/       # SPA 스타터 — 새 프로젝트가 복사해 가는 앱: 라우터 · AppShell · 테마 토글 · API 클라이언트 배선 · 예시 쿼리 · 보호 라우트 (일부러 비어 있다)
├── starter-ssr/   # SSR 스타터 — 같은 페이지를 서버가 첫 응답으로 그려 보내고 브라우저가 이어받는다(plain Vite SSR + Node 서버 · Dockerfile)
├── showcase/      # 갤러리 — 모든 UI 부품 · 토큰 · 패키지 사용 예를 백엔드 없이 눌러 본다(기본으로는 안 찍힌다: --with-showcase)
└── workbench/     # 백엔드 확인용 워크벤치(예전 데모 그대로) + `/packages` 예제 화면. 시각적 테스트 벤치이지 복사 대상이 아니다
packages/
├── api-client/          # REST 클라이언트 — envelope · ApiError · 에러 코드 · traceparent · 멱등 키 · 서버 시각 연결점
├── auth/                # 토큰 저장소 · login/me/socialLogin · 소셜 로그인 도우미 · dev-login/break-glass 헤더 · 401 훅 · AuthProvider · RequireAuth
├── realtime/            # SSE(fetch streaming) · STOMP WebSocket 클라이언트 · 재연결 정책 · React 훅
├── notifications/       # 알림 받은편지함 클라이언트 · TanStack Query 훅 · 안 읽은 수(실시간 갱신) · NotificationBell/List
├── storage/             # 프리사인 업로드 — 검증 · presign · 직접 PUT(진행률 · 취소) · 멀티파트 · useUpload
├── payment/             # 결제 계약 타입 + 얇은 호출 + 토스 리다이렉트 변환 (모듈이 HTTP 를 열지 않아 일부러 얇다)
├── captcha-turnstile/   # Cloudflare Turnstile 로더 · <Turnstile> · 토큰 붙이기
├── time/                # 글로벌 시간(시각 3종 포맷 · 서버 시각 보정 · 국가→시간대)
├── theme/               # system·light·dark 테마 · ThemeToggle · ThemedToaster · 첫 칠 전 스크립트(Vite 플러그인)
├── tokens/              # 디자인 토큰 정본(tokens.json: 색 · 간격 · 모서리 · 글자 크기) + 생성기 + tokens.css(라이트/다크) + 문서 표 생성
└── ui/                  # base.css · Button · Input · Field · Select · Textarea · Checkbox · Switch · Tabs · Table · Pagination · EmptyState · Card · Dialog · Spinner · AppShell · ErrorBoundary · showApiError · toastPromise
scripts/           # new-project.sh(새 프로젝트 찍기) · test-new-project.sh
tests/             # 워크스페이스를 가로지르는 테스트(토큰 층 · 의존 규칙 · ESLint 경계)
docs/design-tokens.md
```

**스켈레톤은 메커니즘을 주고 취향은 주지 않는다.** 색 값 · 문구 · 레이아웃 취향은 프로젝트가 정한다(부품의 문구는 prop, 색은 `tokens.json`).

## 빠른 시작

```bash
pnpm install
pnpm dev              # starter  http://localhost:5173
pnpm dev:ssr          # starter-ssr  http://localhost:3000 (Node 서버 + Vite)
pnpm dev:showcase     # showcase  http://localhost:5173 (백엔드 불필요)
pnpm dev:workbench    # workbench (백엔드 :8080 필요)
pnpm lint
pnpm typecheck        # 모든 앱 · 패키지 + 루트 테스트
pnpm test             # 모든 앱 · 패키지 + 루트 tests/ + new-project 빠른 검사
pnpm format:check
pnpm build            # 두 앱을 빌드(각 apps/*/dist)
pnpm tokens           # packages/tokens/tokens.json → tokens.css + docs/design-tokens.md 표 구역
pnpm tokens:check     # 생성물이 정본과 같은지 확인 (CI)
bash scripts/test-new-project.sh --full   # 세 조합을 찍어 각각 install · lint · typecheck · test · build (네트워크 필요, 수 분 — 별도 CI 워크플로)
```

Node 24(또는 22.18+), pnpm 10.

## 새 프로젝트 시작

백엔드 `scripts/new-project.sh` 처럼, 프론트도 **한 줄로 찍어 낸다**:

```bash
scripts/new-project.sh <target-dir> <name> [--packages a,b,c] [--ssr] [--with-showcase] [--with-workbench] [--scope @acme]

scripts/new-project.sh ~/work/ovation ovation                                      # 스타터 + 스타터가 쓰는 패키지
scripts/new-project.sh ~/work/ovation ovation --packages realtime,notifications,storage
scripts/new-project.sh ~/work/ovation ovation --scope @ovation --packages payment  # 패키지 스코프도 바꾼다
scripts/new-project.sh ~/work/ovation ovation --ssr --with-showcase                 # 서버 렌더 스타터 + 갤러리
```

- 이 레포를 복사해(`node_modules` · `dist` · `.git` 제외) `apps/starter` 를 `apps/<name>` 으로 바꾼다(package.json 이름 · `index.html` 제목 · 헤더 브랜드 · `.env.example`). `apps/workbench` 는 `--with-workbench` 일 때만(그러면 모든 패키지가 따라온다).
- 패키지 = 스타터가 쓰는 것 + 루트 도구(`theme` · `tokens`) + `--packages`, 패키지끼리의 의존으로 **닫은** 집합. 나머지 `packages/<p>` 와 그것을 보던 루트 테스트 항목은 지운다. 모르는 패키지 이름이면 유효한 목록과 함께 exit 2, 대상이 이미 있어도 exit 2(아무것도 만들지 않는다).
- 루트 `package.json`(이름 · `dev`) · eslint 의 앱 이름 막기 · 문서(README · CLAUDE · CHANGELOG)를 새 프로젝트용으로 다시 쓰고, `--scope` 가 있으면 모든 `@skeleton/` 을 바꾼다. `pnpm-workspace.yaml` 은 `apps/*` · `packages/*` 글롭이라 그대로.
- 끝나면 다음 단계를 출력한다: `pnpm install --no-frozen-lockfile`(잠금 파일은 스켈레톤의 것 — 맞춰서 고친다) → `pnpm format`(스코프 · 이름으로 줄바꿈이 달라질 수 있다) → `pnpm dev`.
- 고른 패키지는 **폴더만** 복사된다. 쓰기 시작할 때 앱 `package.json` 에 한 줄(`"@skeleton/<이름>": "workspace:*"`)을 더한다 — 안 쓰는 의존을 선언하면 루트 `pnpm test` 가 막는다(선언한 의존 = 실제 import).
- `--ssr`: `apps/starter` 대신 `apps/starter-ssr` 가 `apps/<name>` 이 된다(이름은 `src/appName.ts` 한 줄). `--with-showcase`: `apps/showcase` 도 남는다(모든 패키지가 따라온다).
- 검증: `scripts/test-new-project.sh --quick`(인자 검증 · 닫힘 · 구조 · 이름/스코프 · 남는 흔적, 수 초 — `pnpm test` 가 부른다), `--full`(네 조합 `기본값` · `--packages realtime,notifications,storage` · `--scope @acme --packages payment` · `--ssr --with-showcase`(서버를 띄우는 통합 테스트 포함)를 찍어 각각 install · lint · typecheck · test · build, CI 의 `new-project` 워크플로).

폴더 복사로 직접 가져가도 된다: 패키지는 각자 `package.json` · 테스트 · README 를 가진 자족 단위이고 서로는 이름으로만 이어져 있다. 이때 `pnpm-workspace.yaml` · 루트 `tsconfig.base.json` · `eslint.config.js` 도 가져온다.

**패키지 내부는 고치지 않는다.** 바꾸고 싶은 것은 설정(옵션) · prop · `tokens.json` 값으로 바꾼다. 안쪽(`@skeleton/*/src/**`)으로 파고드는 import 는 ESLint 가 막는다.

### 패키지 ↔ 백엔드 모듈 ↔ 한 줄 사용

| 패키지              | 의존하는 `@skeleton/*` | 짝인 백엔드(kotlin-skeleton)                                                       | 한 줄 사용                                                                                                                                                   |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api-client`        | —                      | `platform`(envelope · `ApiError` · traceparent)                                    | `createApiClient({ ...apiConfigFromEnv(import.meta.env), getAuthHeaders, onError })`                                                                         |
| `auth`              | api-client             | `auth` · `auth-social*`                                                            | `<AuthProvider session={createAuthSession({ api: createAuthApi(apiClient), store })}>` · `<RequireAuth />` · `createSocialLoginFlow({ providers, session })` |
| `realtime`          | api-client             | `notification-sse` · `notification-websocket`                                      | `useSseClient({ url, getAuthHeaders })` · `useNotificationSocket({ url, getAccessToken })`                                                                   |
| `notifications`     | api-client · time · ui | `notification` + `notification-jdbc`(저장소). HTTP 는 앱(워크벤치 컨트롤러가 데모) | `createNotificationsApi(apiClient)` → `<NotificationBell api={api} />` · `useNotificationIngest()` 를 realtime 훅에 건다                                     |
| `storage`           | api-client             | `storage` + `storage-s3`(`PresignedStorage`). HTTP 는 앱                           | `createUploader({ api: createStorageApi(apiClient, { presign: '/files/presign' }) })` → `useUpload(uploader)`                                                |
| `payment`           | api-client             | `payment` + `payment-toss` · `payment-stripe`. HTTP 는 앱                          | `createPaymentApi(apiClient, { paths: { confirm } })` · `confirmRequestFromTossRedirect(location.search, { currency })`                                      |
| `captcha-turnstile` | —                      | `captcha-turnstile`(`TurnstileVerifier`). HTTP 는 앱                               | `<Turnstile siteKey {...useTurnstileToken().widgetProps} />` · `attachTurnstileToken(body, token)`                                                           |
| `time`              | —                      | `time`                                                                             | `formatInstant(iso)` · `formatDual(zoned)` · `createServerClock()`                                                                                           |
| `theme`             | —                      | —                                                                                  | `plugins: [themePrePaint()]` + 시작할 때 `initTheme()` + `<ThemeToggle />` + `<ThemedToaster />`                                                             |
| `tokens`            | —                      | —                                                                                  | `import '@skeleton/tokens/tokens.css'` (색 · 간격 · 모서리 · 글자 크기는 `tokens.json` 에서)                                                                 |
| `ui`                | api-client             | —                                                                                  | `import '@skeleton/ui/base.css'` + `<Button>` `<Field>` `<Input>` `<Textarea>` `<Checkbox>` `<Tabs>` `<Table>` `<Pagination>` …                              |

「HTTP 는 앱」인 패키지는 백엔드 모듈이 서비스 계약만 주고 엔드포인트를 열지 않아 **경로를 앱이 알려 준다**(기본 경로 없음 — 없는 엔드포인트를 가정하지 않는다). 자세한 API 표 · 어느 파일의 어느 계약인지 · 테스트가 재지 않는 것은 각 `packages/<이름>/README.md`. `ui` · `theme` 의 색은 `tokens` 의 `tokens.css` 가 로드되어야 나온다(JS import 의존은 아니라 `package.json` 에 적지 않는다 — `main.tsx` 맨 앞에서 한 번 import).

## 앱

| 앱            | 무엇                                  | 언제                                                               | 실행                                                                       |
| ------------- | ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `starter`     | SPA 출발점(빈 껍데기)                 | 로그인 뒤 앱 · 대시보드 · 내부 도구. **기본값**                    | `pnpm dev`                                                                 |
| `starter-ssr` | 서버 렌더 출발점                      | 검색 노출(SEO) · 링크 미리보기 · 첫 화면 속도가 필요한 공개 페이지 | `pnpm dev:ssr` · `pnpm --filter starter-ssr build && … start` · Dockerfile |
| `showcase`    | 스켈레톤이 주는 것 전부를 보는 갤러리 | 스타터가 비어 있어 기본 세트를 보고 싶을 때                        | `pnpm dev:showcase`                                                        |
| `workbench`   | 백엔드 확인용 시각적 테스트 벤치      | 백엔드 모듈을 눌러 볼 때                                           | `pnpm dev:workbench`                                                       |

SPA vs SSR: 둘은 같은 패키지 · 같은 페이지다. SPA 는 정적 파일로 호스팅하고 서버가 없다. SSR 은 Node 프로세스 1개를 운영하고(렌더 규칙 · 느린 백엔드 대비 시간 제한), 대신 첫 응답에 내용 · 제목 · 설명이 이미 들어 있다. 필요가 실제로 생긴 앱만 SSR 로 시작한다 — `scripts/new-project.sh <dir> <name> --ssr`.

### `apps/starter-ssr`

서버 렌더 스타터 — 자세한 구조 · 인증(토큰은 브라우저에만, 쿠키 방식으로 바꾸려면) · 하이드레이션 규칙 · 테스트는 [`apps/starter-ssr/README.md`](apps/starter-ssr/README.md).

- 첫 데이터: 서버가 `GET /hello` 를 시간 제한 안에 가져와 HTML 에 그리고 TanStack Query `dehydrate` 로 넘긴다(깜빡임 · 재요청 없음). 백엔드가 죽으면 데이터 없이 200 으로 그린다.
- 상태 코드(200 · 404) · `<html lang>` · 라우트별 `<title>` · 설명, 테마 스크립트는 `<head>` 맨 앞(깜빡임 없음), 보호 라우트는 서버에서 중립 자리 표시.
- `pnpm --filter starter-ssr dev|build|start`. 환경변수 `HOST` `PORT` `API_BASE_URL` `SSR_API_TIMEOUT_MS`.

### `apps/showcase`

백엔드 없이 도는 갤러리 — `/ui`(모든 부품 · 상태 · import 줄) · `/tokens`(실제 토큰, 라이트 · 다크 나란히) · `/packages/<이름>`(가짜 전송 위의 사용 예). [`apps/showcase/README.md`](apps/showcase/README.md).

### `apps/starter`

복사해 가는 출발점. 워크벤치 코드가 없다(루트 테스트가 확인).

- `src/main.tsx` — `QueryClient`(에러 토스트 배선) · `AuthProvider` · `RouterProvider` · `ThemedToaster` · `ErrorBoundary`
- `src/api/createAppApiClient.ts` — `VITE_*` 환경변수 · 토큰 · 시간대 · 서버 시각 · 401 처리를 `createApiClient` 에 잇는 곳. `src/api/client.ts` 가 인스턴스
- `src/hooks/useHello.ts` — `GET /api/v1/hello` 를 부르는 TanStack Query 예시. 새 엔드포인트는 이 모양을 복사
- `src/routes/routes.tsx` — 홈 · 로그인 · `RequireAuth` 아래 `/account` · 404. `src/layouts/RootLayout.tsx` — `AppShell` + `ThemeToggle`
- `.env.example` — `VITE_API_BASE_URL` · `VITE_API_TIMEOUT_MS` · `VITE_API_RETRY_*`(앱 폴더의 `.env` 에 둔다)

### `apps/workbench`

백엔드 모듈을 눌러 보는 시각적 테스트 벤치(REST · SSE · WebSocket · 인증 · break-glass · 모듈 맵). 같은 백엔드 엔드포인트를 그대로 부른다.

- `GET /hello`, `GET /examples/items`, `POST /examples/items`, `POST /examples/jobs`, `POST /auth/login`, `GET /auth/me`(bearer/dev-login/break-glass)
- `GET /notifications/sse?topic=demo`(fetch streaming) · `/ws/notifications`(STOMP). WebSocket 인증을 켠 백엔드는 `auth.login` 으로 받은 bearer token 이 필요하고 dev-login 헤더는 REST/SSE 전용
- `POST /skeleton/notifications` 로 publish 한 뒤 SSE/WebSocket 수신 확인, 요청/응답/status/header trace 를 화면 로그로
- SSE · WebSocket 연결은 `@skeleton/realtime` 훅이 맡고, 화면 로그 변환은 `src/modules/workbench/realtimeExchanges.ts`
- `/packages` — 새 패키지 예제 화면(탭 하나에 패키지 하나): `notifications`(받은편지함 + SSE 로 안 읽은 수) · `storage`(서버/클라이언트 검증) · `payment`(라우팅 확인) · `captcha-turnstile`(테스트 키) · `auth` 소셜 · `ui` 새 부품. `src/modules/demos/`

## 백엔드 연결

- 개발 시 기본값은 `/api/v1/*` 요청을 Vite dev 서버가 `http://localhost:8080` (Kotlin 백엔드)로 proxy(각 앱 `vite.config.ts`)
- CORS 를 직접 검증하거나 다른 백엔드 포트에 붙일 때는 `VITE_API_BASE_URL=http://localhost:<port>/api/v1` 로 실행
- 프로덕션에선 Caddy 가 프론트 정적 번들 + `/api/v1/*` 백엔드 프록시를 같은 origin 으로 합침 → **CORS 불필요**
- `VITE_API_TIMEOUT_MS`, `VITE_API_RETRY_ATTEMPTS`, `VITE_API_RETRY_DELAY_MS` 로 timeout/retry 기본값을 조정

WebSocket URL 은 `VITE_API_BASE_URL` 에서 자동 파생된다. 예: `VITE_API_BASE_URL=http://localhost:18080/api/v1` → `ws://localhost:18080/ws/notifications`.

## API 응답 규칙

- 단건: `client.value<T>('/path')` → 백엔드 `{ value, meta }` 에서 `value`
- 기본: `client.basic('/path')` → `{ meta }`
- 리스트: `client.list<T>('/path')` → `{ values, meta }` 에서 `values`
- 페이지: `client.page<T>('/path')` → `{ values, pagination, meta }` 전체
- 커서: `client.cursor<T>('/path')` → `{ values, cursor, meta }` 전체
- status/header/trace 까지: `client.response<TEnvelope>('/path')`

```ts
await apiClient.response<ApiValueResponse<OrderResponse>>('/orders', {
  method: 'POST',
  idempotencyKey: newIdempotencyKey(),
  traceId,
  json: { productId: 'prod-1' },
})
```

## 디자인 토큰 · 테마

- 색 · 그림자 · 서체 · **간격 · 모서리 · 글자 크기**는 `packages/tokens/tokens.json` 한 곳에서 정하고 `pnpm tokens` 가 `tokens.css` 를 만든다. 층은 둘: 원시(`--p-*`, 화면 CSS 에서 직접 쓰지 않음) → 의미(`--bg` · `--text` · `--teal` · `--space-md` · `--radius-md` · `--font-size-body` …).
- 화면 CSS · 인라인 style 에는 색 날값을 쓰지 않고 `var(--bg)` 처럼 의미 토큰만 쓴다 — 두 앱과 모든 패키지를 루트 `tests/` 가 막는다. `padding` · `margin` · `gap` · `border-radius` · `font-size` 의 px/rem/em 날값도 같다(`--space-*` · `--radius-*` · `--font-size-*`). **예외는 `apps/workbench` CSS 뿐**(540줄 — 옮기려면 `tests/support/layoutExempt.ts` 를 비운다).
- 라이트 + 다크. `<html data-theme="light|dark">`, 없거나 `system` 이면 OS 설정을 따른다. 토글은 `@skeleton/theme`, 저장은 `localStorage`.
- 프로젝트는 `tokens.json` 의 값만 바꿔 자기 색을 입힌다. 모든 글자/바탕 짝이 두 테마에서 WCAG AA 인지는 `pnpm test` 가 잰다.
- 규칙 · 토큰/테마 추가법 · 생성된 표: [`docs/design-tokens.md`](docs/design-tokens.md), 패키지 설명: [`packages/tokens/README.md`](packages/tokens/README.md)

## 경계 규칙 (테스트가 지킨다)

- 패키지는 서로를 **이름**(`@skeleton/<이름>`)으로만 부르고 barrel(`src/index.ts`)과 `exports` 에 적힌 하위 경로만 쓴다. `@skeleton/*/src/**` 딥 임포트 · 폴더를 벗어나는 상대 경로 · 앱 코드 import 는 ESLint(`eslint.config.js`) 와 `tests/workspace.test.ts` 가 막는다.
- 패키지에는 `import.meta.env` 도 모듈 전역 싱글턴도 없다. 환경변수 읽기와 인스턴스 만들기는 앱이 한다.
- 각 앱 · 패키지가 `package.json` 에 선언한 `@skeleton/*` 의존은 소스가 실제로 import 하는 것과 정확히 같아야 한다(= 지울 수 있다). 워크벤치가 아닌 앱(`starter` 와 거기서 찍은 앱)은 워크벤치 코드에 의존하지 않는다.

## 새 프로젝트를 GitHub Template 으로

이 레포는 **GitHub Template**. 새 프로젝트 시작:

1. GitHub 레포 페이지 → **Use this template**
2. 또는 `gh repo create <name> --template turong92/react-skeleton --private`
3. 쓰지 않을 앱 · 패키지는 `scripts/new-project.sh` 로 가려 찍거나(권장 — 위 「새 프로젝트 시작」), 폴더를 직접 지운다.

## Vite → Next.js 전환 고려 시

SSR/SEO 요구가 실제로 생긴 앱은 이 스켈레톤 대신 별도 `react-next-skeleton` 기반으로 시작. 기존 Vite 앱 강제 이주는 안 함. 배경/전환 비용 설명은 `homeserver/docs/SETUP.md` Step 9 참고.
