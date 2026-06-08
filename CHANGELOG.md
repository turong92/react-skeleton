# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
