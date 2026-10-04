# react-skeleton

React + TypeScript + Vite 프론트엔드 스켈레톤. Kotlin modular skeleton 백엔드와 맞물려 돌아가는 개발 워크벤치.

## 스택

- React 19 + TypeScript (strict)
- Vite 8
- axios (표준 HTTP client)
- TanStack Query 5 (서버 상태)
- lucide-react (워크벤치 액션 아이콘)
- ESLint + Prettier
- Vitest (API 클라이언트 계약 · 디자인 토큰 · 테마 테스트)
- 디자인 토큰 (`design/tokens/tokens.json` → CSS 변수, 라이트 + 다크)

## 빠른 시작

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # dist/ 에 정적 번들
pnpm lint
pnpm test
pnpm tokens        # design/tokens/tokens.json → src/styles/tokens.css 생성
pnpm tokens:check  # 생성물이 정본과 같은지 확인 (CI)
```

## 백엔드 연결

- 개발 시 기본값은 `/api/v1/*` 요청을 Vite dev 서버가 `http://localhost:8080` (Kotlin 백엔드)로 proxy
- CORS를 직접 검증하거나 다른 백엔드 포트에 붙일 때는 `VITE_API_BASE_URL=http://localhost:<port>/api/v1` 로 실행
- 프로덕션에선 Caddy가 프론트 정적 번들 + `/api/v1/*` 백엔드 프록시를 같은 origin으로 합침 → **CORS 불필요**
- `VITE_API_TIMEOUT_MS`, `VITE_API_RETRY_ATTEMPTS`, `VITE_API_RETRY_DELAY_MS`로 axios timeout/retry 기본값을 조정

WebSocket URL은 `VITE_API_BASE_URL`에서 자동 파생된다. 예를 들어 `VITE_API_BASE_URL=http://localhost:18080/api/v1`이면 WebSocket은 `ws://localhost:18080/ws/notifications`로 연결한다.

## 워크벤치

- `GET /hello`, `GET /examples/items`, `POST /examples/items`, `POST /examples/jobs` 호출
- `POST /auth/login`, `GET /auth/me` bearer/dev-login/break-glass 호출
- `GET /notifications/sse?topic=demo` fetch streaming 연결
- `/ws/notifications` STOMP WebSocket 연결. WebSocket 인증을 켠 백엔드는 `auth.login`으로 받은 bearer token이 필요하고 dev-login 헤더는 REST/SSE 전용으로 취급
- `POST /skeleton/notifications` publish 후 SSE/WebSocket 이벤트 수신 확인
- 모든 JSON 호출에 `traceparent`, `X-Trace-Id` 자동 부착
- `accessToken`, `Idempotency-Key`, `X-Dev-*`, `X-Break-Glass-*` 헤더 옵션 표준화
- 요청/응답/status/header trace를 화면 로그로 확인

## 구조

```
src/
├── api/
│   ├── client.ts       # 앱 내부 API facade (modules/http 를 사용)
│   ├── traceContext.ts # W3C traceparent 생성
│   ├── types.ts        # ApiError + Basic/Value/List/Page/CursorResponse 표준 DTO 타입
│   └── client.test.ts  # FE ↔ BE API 계약 테스트
├── modules/
│   ├── auth/           # dev-login, token principal, auth header helpers
│   ├── http/           # axios 기반 SkeletonHttpClient
│   ├── notifications/  # SSE stream + STOMP/WebSocket helpers
│   └── workbench/      # 워크벤치 UI 조립 부품/모듈 manifest
├── lib/theme.ts        # 테마 선택(system · light · dark) — <html data-theme> + localStorage
├── styles/tokens.css   # 생성물(손대지 않음) — design/tokens/tokens.json 에서
├── main.tsx            # TanStack Query Provider 세팅
└── routes/HomePage.tsx # 스켈레톤 워크벤치
```

## 디자인 토큰 · 테마

- 색 · 그림자 · 서체는 `design/tokens/tokens.json` 한 곳에서 정하고 `pnpm tokens` 가 `src/styles/tokens.css` 를 만든다. 층은 둘: 원시(`--p-*`, 화면 CSS 에서 직접 쓰지 않음) → 의미(`--bg` · `--text` · `--teal` …).
- 화면 CSS · 인라인 style 에는 색 날값을 쓰지 않고 `var(--bg)` 처럼 의미 토큰만 쓴다(테스트가 막는다).
- 라이트 + 다크. `<html data-theme="light|dark">`, 없거나 `system` 이면 OS 설정을 따른다. 레이아웃 헤더의 토글이 `src/lib/theme.ts` 로 고르고 `localStorage` 에 저장한다.
- 이 스켈레톤에서 시작한 프로젝트는 `tokens.json` 의 값만 바꿔 자기 색을 입힌다. 모든 글자/바탕 짝이 두 테마에서 WCAG AA 인지는 `pnpm test` 가 잰다.
- 규칙 · 토큰/테마 추가법 · 생성된 표: [`docs/design-tokens.md`](docs/design-tokens.md), 정본 · 생성기: [`design/README.md`](design/README.md)

## 모듈화 규칙

- `src/api/client.ts`는 앱이 쓰는 얇은 facade로 유지하고, HTTP 구현은 `src/modules/http`에 둔다.
- 기능별 공통 로직은 `src/modules/<feature>`에 둔다. 예: `auth`, `notifications`, `payment`.
- 화면이 특정 기능을 직접 구현하지 않게 하고, route/page는 모듈을 조립하는 역할에 가깝게 둔다.
- 외부 API client가 필요하면 `createSkeletonHttpClient({ baseURL, timeoutMs, retry, requestInterceptors, responseInterceptors })`로 별도 인스턴스를 만든다.

## API 응답 규칙

- 단건: `api<T>('/path')` 또는 `apiValue<T>('/path')` → 백엔드 `{ value, meta }`에서 `value` 반환
- 기본: `apiBasic('/path')` → 백엔드 `{ meta }` 반환
- 리스트: `apiList<T>('/path')` → 백엔드 `{ values, meta }`에서 `values` 반환
- 페이지: `apiPage<T>('/path')` → 백엔드 `{ values, pagination, meta }` 전체 반환
- 커서: `apiCursor<T>('/path')` → 백엔드 `{ values, cursor, meta }` 전체 반환
- status/header/응답 메타까지 직접 다뤄야 하면 `apiResponse<TEnvelope>('/path')` 사용

```ts
await apiResponse<ApiValueResponse<OrderResponse>>('/orders', {
  method: 'POST',
  accessToken,
  idempotencyKey,
  traceId,
  json: { productId: 'prod-1' },
})
```

## 외부 API client 예시

```ts
const paymentClient = createSkeletonHttpClient({
  baseURL: 'https://api.example-payments.com',
  timeoutMs: 5_000,
  retry: { attempts: 2, delayMs: 150, methods: ['GET', 'POST'] },
  requestInterceptors: [
    (config) => ({
      ...config,
      headers: {
        ...config.headers,
        'X-Client': 'react-skeleton',
      },
    }),
  ],
})
```

## 사용법

이 레포는 **GitHub Template**. 새 프로젝트 시작:

1. GitHub 레포 페이지 → **Use this template**
2. 또는 `gh repo create <name> --template turong92/react-skeleton --private`

## Vite → Next.js 전환 고려 시

SSR/SEO 요구가 실제로 생긴 앱은 이 스켈레톤 대신 별도 `react-next-skeleton` 기반으로 시작. 기존 Vite 앱 강제 이주는 안 함. 배경/전환 비용 설명은 `homeserver/docs/SETUP.md` Step 9 참고.
