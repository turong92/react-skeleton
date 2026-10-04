# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `ApiError` 타입을 백엔드 `ApiError` 와 1:1 로 맞춤: `type` 제거, `code` 추가, `data` 추가, `detail`/`traceId`/`spanId`/`errors`/`FieldError.message` 는 `?: T | null`. `AuthPrincipal.username`/`email` 도 백엔드처럼 nullable(`decodeTokenPrincipal` 는 빠진 claim 을 `'-'` 대신 `null` 로 돌려줌)
- 응답을 못 해석한 4xx/5xx 는 `CLIENT.HTTP_ERROR`, 네트워크 실패는 `CLIENT.NETWORK_ERROR` 코드로 `ApiRequestError` 가 됨. body 에 `code` 가 없으면 ApiError 로 보지 않고 `CLIENT.HTTP_ERROR` 로 처리
- `pnpm typecheck` 가 `tsc -b --noEmit` 으로 app + node 설정을 실제로 검사(전엔 `files: []` 라 아무것도 검사하지 않음). CI 가 lint · tokens:check · typecheck · test · format:check · build 를 실행
- `newIdempotencyKey()` 를 `modules/workbench/workbenchUtils` 에서 `modules/http/idempotencyKey` 로 이동(워크벤치 import 는 re-export 로 유지)
- `package.json` version 을 CHANGELOG/태그에 맞춰 1.1.0 으로

### Added

- `src/api/errorCodes.ts`: 백엔드 Kotlin 에 정의된 에러 코드 상수 `ErrorCodes`(Platform · Auth · AuthSocial · Payment), 클라이언트 합성 코드 `ClientErrorCodes`, 분기 헬퍼 `isErrorCode(error, code | codes[])`
- HTTP 클라이언트 4xx/5xx · 전송 실패 경로 테스트, `isErrorCode` · `newIdempotencyKey` · nullable principal 테스트

### Fixed

- `pnpm format:check` 실패 4개 파일 포맷(동작 변경 없음)
- CLAUDE.md(`client.ts` 는 axios · `hooks/` 없음 · `modules/` 누락) 와 README 템플릿 명령(`turong92/react-skeleton`) 을 실제와 맞춤

### Added

- 디자인 토큰 메커니즘 + 라이트/다크 테마: `design/tokens/tokens.json`(W3C Design Tokens 형식, `$extensions.skeleton`) → `design/tokens/build.mjs`(의존성 없음) → `src/styles/tokens.css` + `docs/design-tokens.md` 표 구역. 층은 원시 `--p-*` → 의미(`--bg`, `--text`, …) 둘. `pnpm tokens`(쓰기) · `pnpm tokens:check`(비교, 어긋나면 1, CI 에 추가). 테마는 `<html data-theme="light|dark">`, 없거나 `system` 이면 `prefers-color-scheme` 을 CSS 만으로 따름(`color-scheme` 포함)
- `src/lib/theme.ts`(`getTheme`/`setTheme`/`useTheme`, localStorage 저장 · 막혀도 동작) + 헤더 `ThemeToggle`(system → light → dark) + `index.html` 인라인 스크립트(첫 칠 전 적용) + sonner 토스트 테마 연동
- 테스트: 생성물 일치 · 날 색 금지(CSS · 인라인 style) · `--p-*` 직접 사용 금지 · `var()` 정의 확인 · 두 테마 WCAG AA 글자/바탕 짝 · 생성기 CLI(`--check` 어긋남 1, 모르는 인자 2)
- `docs/design-tokens.md`(층 · 이름 · 토큰/테마/부품 층 추가법), `design/README.md`

### Changed

- `src/index.css` 의 `:root` 색 · 그림자 · 서체 변수 18개를 `tokens.json` 으로 옮김(이름 그대로, 라이트 화면 변화 없음). `index.css` · `ErrorBoundary` 의 날 색(`#fff`, `#17201c`, `#fbfcfb`, `rgba(...)` 등)을 토큰으로 교체(`--inverse`/`--on-inverse`, `--surface-alt`, `--surface-sunken`, `--header-bg`, `--teal-wash`, `--red-border` 신설)
- `--amber` `#a86612` → `#975c0f`: 옛 값은 `--amber-soft` · `--code-bg` 위에서 AA 4.5:1 미달(4.08 · 3.84)이라 한 단계 어둡게
- `.prettierignore` 에 생성물(`src/styles/tokens.css`, `docs/design-tokens.md`) 추가

- `src/lib/time`: 글로벌 시간 처리 (백엔드 `modules:time` 짝) — `formatInstant`/`formatDate`(변환 없음)/`formatDual`(이벤트+내 시간대, `GMT+9` 표기)/`formatRelative`/`toZonedMoment`(DST 틈·중복 정책 백엔드와 동일)/`zoneLabel`, `createServerClock`(응답 `Date` 헤더로 서버 시각 보정), `defaultZoneOf`/`zonesOf`(국가→시간대, 생성 파일). `Intl` 만 사용. 테스트 9개
- API 클라이언트가 요청마다 `X-Time-Zone`(기기 시간대) 헤더를 붙이고 응답 `Date` 헤더로 `serverClock` 을 보정
- `ErrorBoundary`: 렌더링 에러를 fallback UI로 격리
- `VITE_API_BASE_URL` support in the shared API client for direct backend/CORS verification.
- Standard REST response DTO helpers: `apiValue`, `apiList`, `apiPage`, and `apiEnvelope`.
- `sonner` 기반 전역 API 에러 토스트: `ApiRequestError`의 `traceId`를 표시하고 클릭 복사 지원
- W3C `traceparent` 생성/전파: `traceId`는 전체 플로우, `spanId`는 개별 요청 단계로 사용
- 콘솔/토스트에 `traceId`, `spanId`, `traceparent` 디버깅 정보 출력

## [1.1.0] - 2026-04-20

### Added

- **React Router v7** 도입: `src/routes/` 에 페이지, `src/layouts/RootLayout.tsx` 에 공통 레이아웃
- **TanStack Query DevTools** (dev 모드에서만 로드)
- **api/client.ts 강화**: 요청마다 UUID 기반 `X-Request-Id` 헤더 자동 부착, 에러 응답의 `ApiError` 파싱, 개발 모드 콘솔 그룹 로그 (traceId 포함)
- **api/types.ts**: `ApiError`, `ApiRequestError` — 백엔드 `ApiError`와 1:1 매칭
- **디렉토리 구조**: `src/api/`, `src/routes/`, `src/layouts/`, `src/components/`, `src/hooks/`, `src/lib/` 경계 CLAUDE.md에 명시

### Changed

- `src/App.tsx` 제거 → 라우트 기반 구조로 전환 (`HomePage`, `NotFoundPage`)
- `main.tsx` 가 `QueryClientProvider` + `RouterProvider` + `ReactQueryDevtools` 조합으로 재구성

## [1.0.0] - 2026-04-20

### Added

- Vite + React 19 + TypeScript (strict) 기본 구성
- TanStack Query 5 프로바이더 세팅 (`src/main.tsx`)
- 공통 fetch 래퍼 `src/api/client.ts` (baseURL `/api/v1`)
- Vite dev proxy → `http://localhost:8080/api/v1`
- ESLint + Prettier 설정
- GitHub Actions CI 워크플로 (lint + typecheck + build)
