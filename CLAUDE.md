# react-skeleton — Claude Code 컨텍스트

React + TypeScript + Vite 프론트엔드 스켈레톤. REST 백엔드와 통신하는 SPA 출발점.

## 작업 원칙

- **TypeScript strict**: any 금지. 필요하면 unknown + 타입 가드
- **서버 상태는 TanStack Query로 일원화**: useQuery/useMutation, fetch 직접 사용 지양
- **공통 fetch는 `src/api/client.ts` 래퍼 사용**: baseURL `/api/v1` 고정
- **CSS Modules 우선**: 전역 CSS는 `src/index.css` 에만. 필요해지면 Tailwind/shadcn 추가 검토
- **컴포넌트는 작게 쪼개기**: 한 파일 200줄 넘어가면 분리 신호

## 백엔드와의 통신

Kotlin + Spring Boot 백엔드와 REST (`/api/v1/*`) 통신:

- **개발**: Vite dev(5173) → 백엔드(8080) proxy (vite.config.ts)
- **프로덕션**: Caddy가 같은 origin으로 프론트 정적 번들 + 백엔드 프록시 합침 → CORS 불필요

## 왜 Vite (Next.js 아님)

PoC 기동 속도 + AI 친화성. 정적 번들 출력이라 호스팅 자유도 높음. SSR/SEO 필요한 앱이 실제로 나오면 그 앱만 `react-next-skeleton` 신규 스켈레톤 써서 새로 시작 (기존 Vite 앱 강제 이주는 안 함).

## 변경 이력

`CHANGELOG.md` 에 기록. 새 기능은 `[Unreleased]` 섹션에 먼저 적고 릴리스 시 버전 섹션으로 승격.
