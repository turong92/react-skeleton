# react-skeleton

React + TypeScript + Vite 프론트엔드 스켈레톤 — **pnpm 워크스페이스**. Kotlin modular skeleton 백엔드(`modules/`)와 같은 방식으로, 프로젝트가 필요한 조각만 한 줄씩 골라 쓴다.

```
apps/
├── starter/       # 새 프로젝트가 복사해 가는 앱 — 라우터 · AppShell · 테마 토글 · API 클라이언트 배선 · 예시 쿼리 · 보호 라우트
└── workbench/     # 백엔드 확인용 워크벤치(예전 데모 그대로). 시각적 테스트 벤치이지 복사 대상이 아니다
packages/
├── api-client/    # REST 클라이언트 — envelope · ApiError · 에러 코드 · traceparent · 멱등 키 · 서버 시각 연결점
├── auth/          # 토큰 저장소 · login/me/socialLogin · dev-login/break-glass 헤더 · 401 훅 · AuthProvider · RequireAuth
├── realtime/      # SSE(fetch streaming) · STOMP WebSocket 클라이언트 · 재연결 정책 · React 훅
├── time/          # 글로벌 시간(시각 3종 포맷 · 서버 시각 보정 · 국가→시간대)
├── theme/         # system·light·dark 테마 · ThemeToggle · ThemedToaster · 첫 칠 전 스크립트(Vite 플러그인)
├── tokens/        # 디자인 토큰 정본(tokens.json) + 생성기 + tokens.css(라이트/다크) + 문서 표 생성
└── ui/            # base.css · Button · Input · Field · Select · Card · Dialog · Spinner · AppShell · ErrorBoundary · showApiError
tests/             # 워크스페이스를 가로지르는 테스트(토큰 층 · 의존 규칙 · ESLint 경계)
docs/design-tokens.md
```

**스켈레톤은 메커니즘을 주고 취향은 주지 않는다.** 색 값 · 문구 · 레이아웃 취향은 프로젝트가 정한다(부품의 문구는 prop, 색은 `tokens.json`).

## 빠른 시작

```bash
pnpm install
pnpm dev              # starter  http://localhost:5173
pnpm dev:workbench    # workbench (백엔드 :8080 필요)
pnpm lint
pnpm typecheck        # 모든 앱 · 패키지 + 루트 테스트
pnpm test             # 모든 앱 · 패키지 + 루트 tests/
pnpm format:check
pnpm build            # 두 앱을 빌드(각 apps/*/dist)
pnpm tokens           # packages/tokens/tokens.json → tokens.css + docs/design-tokens.md 표 구역
pnpm tokens:check     # 생성물이 정본과 같은지 확인 (CI)
```

Node 24(또는 22.18+), pnpm 10.

## 새 프로젝트 시작

백엔드 `modules/` 를 한 줄로 가져다 쓰듯, 프론트도 **폴더를 복사하고 한 줄로 선언**한다.

1. 이 레포(또는 GitHub Template)에서 `apps/starter` 와 **필요한 `packages/<이름>`** 만 새 레포로 복사한다. 패키지끼리의 의존은 이름으로만 이어져 있고(아래 표) 폴더 하나로 자족한다.
2. 앱 `package.json` 에 쓸 패키지를 한 줄씩: `"@skeleton/<이름>": "workspace:*"`. `pnpm-workspace.yaml`(`apps/*`, `packages/*`) 과 루트 `tsconfig.base.json` · `eslint.config.js` 도 가져온다.
3. 패키지 **내부는 고치지 않는다.** 바꾸고 싶은 것은 설정(옵션) · prop · `tokens.json` 값으로 바꾼다. 안쪽(`@skeleton/*/src/**`)으로 파고드는 import 는 ESLint 가 막는다.
4. 앱 이름(`apps/starter/package.json` 의 `name`)과 `index.html` 제목을 바꾸고, 쓰지 않는 패키지는 폴더 · 의존 줄을 지운다 — 루트 `pnpm test` 가 「선언한 의존 = 실제 import」를 확인한다.

| 패키지       | 의존하는 `@skeleton/*` | 한 줄 사용                                                                                                               |
| ------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `api-client` | —                      | `createApiClient({ ...apiConfigFromEnv(import.meta.env), getAuthHeaders, onError })`                                     |
| `auth`       | api-client             | `<AuthProvider session={createAuthSession({ api: createAuthApi(apiClient), store })}>` · `<RequireAuth />` · `useAuth()` |
| `realtime`   | api-client             | `useSseClient({ url, getAuthHeaders })` · `useNotificationSocket({ url, getAccessToken })`                               |
| `time`       | —                      | `formatInstant(iso)` · `formatDual(zoned)` · `createServerClock()`                                                       |
| `theme`      | —                      | `plugins: [themePrePaint()]` + `<ThemeToggle />` + `<ThemedToaster />`                                                   |
| `tokens`     | —                      | `import '@skeleton/tokens/tokens.css'` (색은 `tokens.json` 에서)                                                         |
| `ui`         | api-client             | `import '@skeleton/ui/base.css'` + `<Button>` `<Field>` `<Input>` `<Card>` `<Dialog>` `<AppShell>` …                     |

자세한 API 표는 각 `packages/<이름>/README.md`. `ui` · `theme` 의 색은 `tokens` 의 `tokens.css` 가 로드되어야 나온다(JS import 의존은 아니라 `package.json` 에 적지 않는다 — `main.tsx` 맨 앞에서 한 번 import).

## 앱

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

- 색 · 그림자 · 서체는 `packages/tokens/tokens.json` 한 곳에서 정하고 `pnpm tokens` 가 `tokens.css` 를 만든다. 층은 둘: 원시(`--p-*`, 화면 CSS 에서 직접 쓰지 않음) → 의미(`--bg` · `--text` · `--teal` …).
- 화면 CSS · 인라인 style 에는 색 날값을 쓰지 않고 `var(--bg)` 처럼 의미 토큰만 쓴다 — 두 앱과 모든 패키지를 루트 `tests/` 가 막는다.
- 라이트 + 다크. `<html data-theme="light|dark">`, 없거나 `system` 이면 OS 설정을 따른다. 토글은 `@skeleton/theme`, 저장은 `localStorage`.
- 프로젝트는 `tokens.json` 의 값만 바꿔 자기 색을 입힌다. 모든 글자/바탕 짝이 두 테마에서 WCAG AA 인지는 `pnpm test` 가 잰다.
- 규칙 · 토큰/테마 추가법 · 생성된 표: [`docs/design-tokens.md`](docs/design-tokens.md), 패키지 설명: [`packages/tokens/README.md`](packages/tokens/README.md)

## 경계 규칙 (테스트가 지킨다)

- 패키지는 서로를 **이름**(`@skeleton/<이름>`)으로만 부르고 barrel(`src/index.ts`)과 `exports` 에 적힌 하위 경로만 쓴다. `@skeleton/*/src/**` 딥 임포트 · 폴더를 벗어나는 상대 경로 · 앱 코드 import 는 ESLint(`eslint.config.js`) 와 `tests/workspace.test.ts` 가 막는다.
- 패키지에는 `import.meta.env` 도 모듈 전역 싱글턴도 없다. 환경변수 읽기와 인스턴스 만들기는 앱이 한다.
- 각 앱 · 패키지가 `package.json` 에 선언한 `@skeleton/*` 의존은 소스가 실제로 import 하는 것과 정확히 같아야 한다(= 지울 수 있다). `starter` 는 워크벤치 코드에 의존하지 않는다.

## 새 프로젝트를 GitHub Template 으로

이 레포는 **GitHub Template**. 새 프로젝트 시작:

1. GitHub 레포 페이지 → **Use this template**
2. 또는 `gh repo create <name> --template turong92/react-skeleton --private`
3. 위 「새 프로젝트 시작」 순서로 쓰지 않을 앱 · 패키지를 걷어 낸다.

## Vite → Next.js 전환 고려 시

SSR/SEO 요구가 실제로 생긴 앱은 이 스켈레톤 대신 별도 `react-next-skeleton` 기반으로 시작. 기존 Vite 앱 강제 이주는 안 함. 배경/전환 비용 설명은 `homeserver/docs/SETUP.md` Step 9 참고.
