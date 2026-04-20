# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-20

### Added
- Vite + React 19 + TypeScript (strict) 기본 구성
- TanStack Query 5 프로바이더 세팅 (`src/main.tsx`)
- 공통 fetch 래퍼 `src/api/client.ts` (baseURL `/api/v1`)
- Vite dev proxy → `http://localhost:8080/api/v1`
- ESLint + Prettier 설정
- GitHub Actions CI 워크플로 (lint + typecheck + build)
