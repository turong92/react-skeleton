# react-skeleton — Claude Code 컨텍스트

React + TypeScript + Vite 프론트엔드 스켈레톤. REST 백엔드와 통신하는 SPA 출발점.

## 디렉토리 구조 (AI 참조용)

```
src/
├── main.tsx          # 엔트리 (QueryClient + RouterProvider 세팅, 수정 거의 없음)
├── api/              # REST 클라이언트 + 공통 타입
│   ├── client.ts     # 앱 전역 API 클라이언트(axios 기반 `modules/http` 를 감싼 얇은 진입점. X-Time-Zone · 서버 시각 보정)
│   ├── errorCodes.ts # 백엔드 에러 코드 상수(ErrorCodes) + `isErrorCode(error, code)` 분기 헬퍼
│   ├── traceContext.ts # W3C traceId/spanId/traceparent 생성
│   └── types.ts      # ApiError(백엔드 ApiError 와 1:1), ApiRequestError, AuthPrincipal, ApiValue/List/PageResponse 표준 DTO 타입
├── routes/           # 페이지 컴포넌트 + 라우트 정의
│   ├── index.tsx     # createBrowserRouter 정의 (여기서 path → page 매핑)
│   ├── HomePage.tsx
│   └── NotFoundPage.tsx
├── layouts/          # 레이아웃 (헤더/푸터 + <Outlet />)
│   └── RootLayout.tsx
├── components/       # 재사용 UI 조각 (필요 시 추가)
├── modules/          # 백엔드 모듈과 짝인 기능 조각 (화면 없이 테스트되는 로직)
│   ├── http/         # axios 기반 클라이언트(createSkeletonHttpClient: 헤더 · 재시도 · ApiRequestError) + newIdempotencyKey
│   ├── auth/         # 개발 로그인 헤더 · JWT principal 해석
│   ├── notifications/ # SSE · STOMP 알림 스트림 + 재연결 정책
│   └── workbench/    # 백엔드 모듈 확인용 워크벤치(HomePage 가 사용)
├── lib/              # 유틸/헬퍼
│   ├── theme.ts      # 테마 선택(system·light·dark) — <html data-theme> + localStorage, useTheme 훅
│   └── time/         # 글로벌 시간 (백엔드 modules:time 짝): formatInstant / formatDate(변환 없음) / formatDual / toZonedMoment / serverClock / 국가→시간대
├── styles/
│   └── tokens.css    # 생성물(손대지 않음) — design/tokens/tokens.json 에서 `pnpm tokens`
└── index.css         # 전역 CSS (최소한으로 사용, 색은 토큰만)

design/tokens/        # tokens.json(정본) + build.mjs(생성기) — docs/design-tokens.md 참고
docs/design-tokens.md # 토큰 층 · 이름 · 추가법 + 생성된 표
```

**경계 책임:**

- `routes/` 는 페이지 단위 조합 + 데이터 fetching (TanStack Query 훅 호출)
- `components/` 는 재사용 가능한 순수 UI (props만 받음, API 호출 금지)
- HTTP 호출은 `api/`(→ `modules/http`)만 수행. 페이지/컴포넌트에선 `api/`의 함수 사용
- 한 파일 200줄 넘어가면 분할 신호

## 핵심 컨벤션

- **TypeScript strict**: `any` 금지. 필요하면 `unknown` + 타입 가드
- **서버 상태는 TanStack Query로 일원화**: `useQuery`/`useMutation`. raw fetch 금지
- **공통 HTTP 는 `src/api/client.ts`(axios 기반) 사용**: baseURL 은 `VITE_API_BASE_URL` 또는 `/api/v1`. 에러는 `ApiRequestError` — 코드 분기는 `isErrorCode(error, ErrorCodes.AUTH_INVALID_CREDENTIALS)`, 코드는 백엔드 Kotlin enum 에 있는 것만 `src/api/errorCodes.ts` 에 둔다
- **응답 DTO 표준화**: 단건은 `api<T>()`, 리스트는 `apiList<T>()`, 페이지는 `apiPage<T>()`, 메타까지 필요하면 `apiEnvelope<TEnvelope>()`
- **디자인 토큰**: 색 · 그림자 · 서체 값은 `design/tokens/tokens.json` 에서만 정한다. 층은 둘 — 원시 `--p-*`(화면 CSS 에서 직접 사용 금지) → 의미 `--bg` `--text` …. 화면 CSS · 인라인 style 은 의미 토큰(`var(--…)`)만 쓴다(날 색 금지). 생성물 `src/styles/tokens.css` · `docs/design-tokens.md` 표 구역은 손으로 고치지 않고 `pnpm tokens`, CI 는 `pnpm tokens:check`. 라이트/다크는 `<html data-theme>`(`src/lib/theme.ts`), 글자/바탕 짝은 `src/styles/contrast.test.ts` 에 등록해 AA 를 지킨다. 부품(component) 층은 필요해질 때 추가(`docs/design-tokens.md`)
- **CSS Modules 우선**: 전역 CSS는 `src/index.css` 에만. 필요해지면 Tailwind/shadcn 추가 검토
- **시각 3종** (`src/lib/time`): ISO `...Z` 는 `formatInstant`, `YYYY-MM-DD` 는 `formatDate`(시간대 변환 금지), `ZonedMoment {local, zone, at}` 는 `formatDual`(이벤트 시간대 + 내 시간대). `new Date('YYYY-MM-DD')` 금지. 카운트다운은 `serverClock.now()`. API 클라이언트가 `X-Time-Zone` 을 자동으로 보낸다

## 백엔드와의 통신

Kotlin + Spring Boot 백엔드와 REST (`/api/v1/*`) 통신:

- **개발 기본값**: Vite dev(5173) → 백엔드(8080) proxy (vite.config.ts)
- **개발 direct 검증**: `VITE_API_BASE_URL=http://localhost:<port>/api/v1` 로 다른 포트 백엔드에 직접 연결. 이때 백엔드 CORS를 켜야 한다.
- **프로덕션**: Caddy가 같은 origin으로 프론트 정적 번들 + 백엔드 프록시 합침 → CORS 불필요

### REST 응답 DTO

- 백엔드는 단건 `{ value, meta }`, 리스트 `{ values, meta }`, 페이지 `{ values, pagination, meta }`를 반환한다.
- `api<T>()`/`apiValue<T>()`는 단건 envelope를 검증하고 `value`만 반환한다.
- `apiList<T>()`는 리스트 envelope를 검증하고 `values`만 반환한다.
- `apiPage<T>()`는 페이지 envelope를 검증하고 `values`, `pagination`, `meta` 전체를 반환한다.
- 표준 envelope 전체가 필요하면 `apiEnvelope<ApiValueResponse<T>>()`처럼 명시한다.

### traceId 기반 디버깅

- `api/client.ts` 가 요청마다 W3C `traceparent` 헤더 자동 부착
- 같은 작업 전체를 하나로 묶고 싶으면 같은 `traceId`를 `api('/path', { traceId })`로 넘김
- 백엔드(`TraceIdFilter`)가 traceId를 승계하고 현재 요청 spanId를 새로 생성
- 응답을 못 해석하면 클라이언트가 `CLIENT.HTTP_ERROR`(body 가 ApiError 계약 아님) · `CLIENT.NETWORK_ERROR`(status 0) 코드를 채운다 — 백엔드 코드가 아니다
- 에러 시 콘솔/토스트에 traceId와 spanId 출력됨 → traceId로 전체 플로우 grep, spanId로 특정 요청 단계 좁히기
- TanStack Query DevTools (개발 모드에서만) 로 쿼리 상태 실시간 확인 가능

## 왜 Vite (Next.js 아님)

PoC 기동 속도 + AI 친화성. 정적 번들 출력이라 호스팅 자유도 높음. SSR/SEO 필요한 앱이 실제로 나오면 그 앱만 `react-next-skeleton` 신규 스켈레톤 써서 새로 시작 (기존 Vite 앱 강제 이주는 안 함).

## 새 페이지 추가 시

1. `src/routes/XxxPage.tsx` 생성 (named export 함수형 컴포넌트)
2. `src/routes/index.tsx` 의 `children` 배열에 `{ path: '/xxx', element: <XxxPage /> }` 추가
3. 필요하면 `layouts/RootLayout.tsx` 에 네비게이션 링크 추가
4. 데이터 fetch는 TanStack Query + `api/client.ts` 의 `api<T>('/path')`, `apiList<T>('/path')`, `apiPage<T>('/path')` 사용

## 검증 명령

`pnpm lint` · `pnpm tokens:check` · `pnpm typecheck`(`tsc -b --noEmit`: app + node 설정 모두) · `pnpm test` · `pnpm format:check` · `pnpm build`. CI(`.github/workflows/ci.yml`)가 같은 순서로 돈다.

## 변경 이력

`CHANGELOG.md` 에 기록. 새 기능은 `[Unreleased]` 섹션에 먼저 적고 릴리스 시 버전 섹션으로 승격.
