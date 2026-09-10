# react-skeleton — Claude Code 컨텍스트

React + TypeScript + Vite 프론트엔드 스켈레톤. REST 백엔드와 통신하는 SPA 출발점.

## 디렉토리 구조 (AI 참조용)

```
src/
├── main.tsx          # 엔트리 (QueryClient + RouterProvider 세팅, 수정 거의 없음)
├── api/              # REST 클라이언트 + 공통 타입
│   ├── client.ts     # fetch 래퍼 (traceparent 자동 부착, 에러 파싱, 로깅)
│   ├── traceContext.ts # W3C traceId/spanId/traceparent 생성
│   └── types.ts      # ApiError, ApiRequestError, ApiValue/List/PageResponse 표준 DTO 타입
├── routes/           # 페이지 컴포넌트 + 라우트 정의
│   ├── index.tsx     # createBrowserRouter 정의 (여기서 path → page 매핑)
│   ├── HomePage.tsx
│   └── NotFoundPage.tsx
├── layouts/          # 레이아웃 (헤더/푸터 + <Outlet />)
│   └── RootLayout.tsx
├── components/       # 재사용 UI 조각 (필요 시 추가)
├── hooks/            # 커스텀 훅 (필요 시 추가)
├── lib/              # 유틸/헬퍼
│   └── time/         # 글로벌 시간 (백엔드 modules:time 짝): formatInstant / formatDate(변환 없음) / formatDual / toZonedMoment / serverClock / 국가→시간대
└── index.css         # 전역 CSS (최소한으로 사용)
```

**경계 책임:**

- `routes/` 는 페이지 단위 조합 + 데이터 fetching (TanStack Query 훅 호출)
- `components/` 는 재사용 가능한 순수 UI (props만 받음, API 호출 금지)
- `api/` 만 fetch 수행. 페이지/컴포넌트에선 `api/`의 훅/함수 사용
- 한 파일 200줄 넘어가면 분할 신호

## 핵심 컨벤션

- **TypeScript strict**: `any` 금지. 필요하면 `unknown` + 타입 가드
- **서버 상태는 TanStack Query로 일원화**: `useQuery`/`useMutation`. raw fetch 금지
- **공통 fetch는 `src/api/client.ts` 래퍼 사용**: baseURL 은 `VITE_API_BASE_URL` 또는 `/api/v1`
- **응답 DTO 표준화**: 단건은 `api<T>()`, 리스트는 `apiList<T>()`, 페이지는 `apiPage<T>()`, 메타까지 필요하면 `apiEnvelope<TEnvelope>()`
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
- 에러 시 콘솔/토스트에 traceId와 spanId 출력됨 → traceId로 전체 플로우 grep, spanId로 특정 요청 단계 좁히기
- TanStack Query DevTools (개발 모드에서만) 로 쿼리 상태 실시간 확인 가능

## 왜 Vite (Next.js 아님)

PoC 기동 속도 + AI 친화성. 정적 번들 출력이라 호스팅 자유도 높음. SSR/SEO 필요한 앱이 실제로 나오면 그 앱만 `react-next-skeleton` 신규 스켈레톤 써서 새로 시작 (기존 Vite 앱 강제 이주는 안 함).

## 새 페이지 추가 시

1. `src/routes/XxxPage.tsx` 생성 (named export 함수형 컴포넌트)
2. `src/routes/index.tsx` 의 `children` 배열에 `{ path: '/xxx', element: <XxxPage /> }` 추가
3. 필요하면 `layouts/RootLayout.tsx` 에 네비게이션 링크 추가
4. 데이터 fetch는 TanStack Query + `api/client.ts` 의 `api<T>('/path')`, `apiList<T>('/path')`, `apiPage<T>('/path')` 사용

## 변경 이력

`CHANGELOG.md` 에 기록. 새 기능은 `[Unreleased]` 섹션에 먼저 적고 릴리스 시 버전 섹션으로 승격.
