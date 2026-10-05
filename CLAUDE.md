# react-skeleton — Claude Code 컨텍스트

React + TypeScript + Vite 프론트엔드 스켈레톤. pnpm 워크스페이스 — 캡슐화된 패키지 7개 + 앱 2개. REST 백엔드(kotlin-skeleton)와 통신하는 SPA 출발점이고, 백엔드 `modules/` 처럼 프로젝트가 필요한 패키지만 한 줄씩 골라 쓴다.

## 디렉토리 구조 (AI 참조용)

```
apps/
├── starter/                  # 새 프로젝트가 복사해 가는 앱 (워크벤치 코드 없음)
│   ├── src/main.tsx          # QueryClient(에러 토스트) · AuthProvider · RouterProvider · ErrorBoundary
│   ├── src/api/              # createAppApiClient(환경변수 · 토큰 · 시간대 · 서버 시각 · 401 배선) · client(인스턴스) · serverClock
│   ├── src/app/createQueryClient.ts
│   ├── src/auth/             # tokenStore(저장소 선택) · session(createAuthSession)
│   ├── src/hooks/useHello.ts # TanStack Query 예시(GET /hello)
│   ├── src/layouts/RootLayout.tsx   # AppShell + ThemeToggle
│   └── src/routes/           # routes.tsx(path → page) · index.tsx(router) · Home · Login · Account(RequireAuth 아래) · NotFound
└── workbench/                # 백엔드 확인용 시각적 테스트 벤치(HomePage · modules/workbench · workbench.css)
packages/                     # 서로를 이름으로만 부른다. 각자 package.json(exports=src/index.ts) · 테스트 · README
├── api-client/               # createApiClient(config) · ApiRequestError · ErrorCodes/isErrorCode · createTraceContext · newIdempotencyKey · apiConfigFromEnv
├── auth/                     # createTokenStore · createAuthApi · createAuthSession · AuthProvider/useAuth/RequireAuth · dev-login/break-glass 헤더 · 401 훅
├── realtime/                 # createSseClient · createStompNotificationClient · useSseClient · useNotificationSocket · 재연결 정책
├── time/                     # formatInstant/formatDate/formatDual · createServerClock · 국가→시간대
├── theme/                    # theme.ts · ThemeToggle · ThemedToaster · PRE_PAINT_SCRIPT + @skeleton/theme/vite(themePrePaint)
├── tokens/                   # tokens.json(정본) · build.mjs(생성기) · tokens.css(생성물) · 테스트 도구
└── ui/                       # base.css · Button/Input/Field/Select/Card/Dialog/Spinner/AppShell · ErrorBoundary · showApiError
tests/                        # 워크스페이스 가로지르는 테스트: usage(날 색 · --p-* · var 정의) · contrast(AA 짝) · tokens.wiring · theme.names · workspace(의존 규칙) · eslint.boundaries
docs/design-tokens.md         # 토큰 층 · 이름 · 추가법 + 생성된 표
```

**경계 책임:**

- `routes/` 는 페이지 단위 조합 + 데이터 fetching (TanStack Query 훅 호출)
- 재사용 UI 는 `@skeleton/ui`(props만 받음, API 호출 금지). 앱 전용 조각은 앱 안
- HTTP 호출은 앱의 `api/client.ts`(= `createApiClient` 인스턴스)만 수행. 페이지/컴포넌트에선 훅(`useQuery`)을 통해 쓴다
- 패키지는 `import.meta.env` · 모듈 전역 싱글턴 · 앱 코드 import 가 없다 — 환경변수 읽기와 인스턴스는 앱이 만든다
- 한 파일 200줄 넘어가면 분할 신호

## 핵심 컨벤션

- **패키지 안쪽 금지**: 다른 패키지는 이름(`@skeleton/<이름>`)과 `exports` 하위 경로(`/tokens.css` · `/vite` · `/base.css`)로만 쓴다. `@skeleton/*/src/**` · 폴더를 벗어나는 상대 import · 앱 import 는 ESLint(`eslint.config.js`) + `tests/workspace.test.ts` 가 막는다
- **의존 선언 = 실제 import**: 앱 · 패키지가 `package.json` 에 적은 `@skeleton/*` 는 소스가 import 하는 것과 정확히 같아야 한다(`workspace:*`). 패키지를 새로 쓰면 앱 `package.json` 에 한 줄 더한다. `starter` 는 워크벤치에 의존하지 않는다. 패키지가 외부 라이브러리를 쓰면 `dependencies`(또는 `peerDependencies`)에 선언한다 — 이것도 테스트가 확인
- **패키지를 만들거나 키울 때**: `package.json`(`exports` `.` = `{ types, default: ./src/index.ts }`, `test` · `typecheck` 스크립트) · `src/index.ts` barrel(공개 표면은 이것뿐) · 옆에 테스트 · `README.md`(API 표)를 갖춘다. 사용자에게 보이는 문구는 prop(기본 영어), 색은 의미 토큰만
- **TypeScript strict**: `any` 금지. 필요하면 `unknown` + 타입 가드. 패키지 tsconfig 는 `types: []`(DOM 쓰는 UI 패키지만 `vite/client`)라 `import.meta.env` 를 쓰면 타입 에러
- **서버 상태는 TanStack Query로 일원화**: `useQuery`/`useMutation`. raw fetch 금지(실시간 스트림은 `@skeleton/realtime`)
- **공통 HTTP 는 `createApiClient`(axios 기반)**: baseUrl 은 `apiConfigFromEnv(import.meta.env)`(`VITE_API_BASE_URL` 또는 `/api/v1`). 에러는 `ApiRequestError` — 코드 분기는 `isErrorCode(error, ErrorCodes.AUTH_INVALID_CREDENTIALS)`, 코드는 백엔드 Kotlin enum 에 있는 것만 `packages/api-client/src/errorCodes.ts` 에 둔다
- **응답 DTO 표준화**: 단건은 `client.value<T>()`, 리스트는 `list<T>()`, 페이지는 `page<T>()`, 메타까지 필요하면 `response()`/`envelope()`
- **인증**: 토큰은 `@skeleton/auth` 의 `createTokenStore`(저장소 주입), 요청에는 `getAuthHeaders: createAuthHeadersProvider(store)`, 401 은 `onError: createUnauthorizedHandler({ store })`. 로그인한 사람만 보는 라우트는 `<RequireAuth />` 아래. dev-login/break-glass 헤더는 개발 · 점검용(`devLoginHeaders` · `breakGlassHeaders`)
- **디자인 토큰**: 색 · 그림자 · 서체 값은 `packages/tokens/tokens.json` 에서만 정한다. 층은 둘 — 원시 `--p-*`(화면 CSS 에서 직접 사용 금지) → 의미 `--bg` `--text` …. 화면 CSS · 인라인 style 은 의미 토큰(`var(--…)`)만 쓴다(날 색 금지). 생성물 `packages/tokens/tokens.css` · `docs/design-tokens.md` 표 구역은 손으로 고치지 않고 `pnpm tokens`, CI 는 `pnpm tokens:check`. 라이트/다크는 `<html data-theme>`(`@skeleton/theme`), 글자/바탕 짝은 `tests/contrast.test.ts` 에 등록해 AA 를 지킨다. 부품(component) 층은 필요해질 때 추가(`docs/design-tokens.md`)
- **CSS Modules 우선**: 전역 CSS는 앱의 CSS 한 개(예: `apps/workbench/src/workbench.css`)와 `@skeleton/ui/base.css`(리셋 · 요소 타이포)에만. 필요해지면 Tailwind/shadcn 추가 검토
- **시각 3종** (`@skeleton/time`): ISO `...Z` 는 `formatInstant`, `YYYY-MM-DD` 는 `formatDate`(시간대 변환 금지), `ZonedMoment {local, zone, at}` 는 `formatDual`(이벤트 시간대 + 내 시간대). `new Date('YYYY-MM-DD')` 금지. 카운트다운은 `serverClock.now()`. 앱이 `getTimeZone: userTimeZone`, `onResponseDate` 로 연결하면 `X-Time-Zone` 이 자동으로 간다

## 백엔드와의 통신

Kotlin + Spring Boot 백엔드와 REST (`/api/v1/*`) 통신:

- **개발 기본값**: Vite dev(5173) → 백엔드(8080) proxy (각 앱 `vite.config.ts`)
- **개발 direct 검증**: `VITE_API_BASE_URL=http://localhost:<port>/api/v1` 로 다른 포트 백엔드에 직접 연결(앱 폴더 `.env`). 이때 백엔드 CORS를 켜야 한다.
- **프로덕션**: Caddy가 같은 origin으로 프론트 정적 번들 + 백엔드 프록시 합침 → CORS 불필요

### REST 응답 DTO

- 백엔드는 단건 `{ value, meta }`, 리스트 `{ values, meta }`, 페이지 `{ values, pagination, meta }`를 반환한다.
- `value<T>()` 는 단건 envelope를 검증하고 `value`만, `list<T>()` 는 `values`만, `page<T>()` 는 `values`·`pagination`·`meta` 전체를 반환한다.
- 표준 envelope 전체가 필요하면 `envelope<ApiValueResponse<T>>()` 처럼 명시한다.

### traceId 기반 디버깅

- `createApiClient` 가 요청마다 W3C `traceparent` 헤더 자동 부착
- 같은 작업 전체를 하나로 묶고 싶으면 같은 `traceId`를 `client.value('/path', { traceId })`로 넘김(실시간 클라이언트도 `traceId` 옵션)
- 백엔드(`TraceIdFilter`)가 traceId를 승계하고 현재 요청 spanId를 새로 생성
- 응답을 못 해석하면 클라이언트가 `CLIENT.HTTP_ERROR`(body 가 ApiError 계약 아님) · `CLIENT.NETWORK_ERROR`(status 0) 코드를 채운다 — 백엔드 코드가 아니다
- 에러 시 토스트(`showApiError`)에 traceId와 spanId 출력됨 → traceId로 전체 플로우 grep, spanId로 특정 요청 단계 좁히기
- TanStack Query DevTools (개발 모드 + `VITE_REACT_QUERY_DEVTOOLS=true`) 로 쿼리 상태 실시간 확인 가능

## 왜 Vite (Next.js 아님)

PoC 기동 속도 + AI 친화성. 정적 번들 출력이라 호스팅 자유도 높음. SSR/SEO 필요한 앱이 실제로 나오면 그 앱만 `react-next-skeleton` 신규 스켈레톤 써서 새로 시작 (기존 Vite 앱 강제 이주는 안 함).

## 새 페이지 추가 시 (앱 안)

1. `apps/<앱>/src/routes/XxxPage.tsx` 생성 (named export 함수형 컴포넌트)
2. `src/routes/routes.tsx` 의 `children` 배열에 `{ path: '/xxx', element: <XxxPage /> }` 추가 (로그인 필요하면 `RequireAuth` 아래 `children`)
3. 필요하면 `layouts/RootLayout.tsx` 에 네비게이션 링크 추가
4. 데이터 fetch는 TanStack Query 훅(`hooks/useHello.ts` 모양) + `apiClient.value<T>('/path')`

## 검증 명령

루트에서: `pnpm lint` · `pnpm tokens:check` · `pnpm typecheck`(모든 앱 · 패키지 `tsc` + 루트 tests) · `pnpm test`(각 앱 · 패키지 + 루트 `tests/`) · `pnpm format:check` · `pnpm build`(두 앱). CI(`.github/workflows/ci.yml`)가 같은 순서로 돈다. 한 곳만: `pnpm --filter @skeleton/auth test`. dev 서버: `pnpm dev`(starter) · `pnpm dev:workbench`.

## 변경 이력

`CHANGELOG.md` 에 기록. 새 기능은 `[Unreleased]` 섹션에 먼저 적고 릴리스 시 버전 섹션으로 승격.
