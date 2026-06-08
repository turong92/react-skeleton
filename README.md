# react-skeleton

React + TypeScript + Vite 프론트엔드 스켈레톤. REST 백엔드와 통신하는 SPA 시작점.

## 스택

- React 19 + TypeScript (strict)
- Vite 8
- TanStack Query 5 (서버 상태)
- ESLint + Prettier

## 빠른 시작

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # dist/ 에 정적 번들
pnpm lint
```

## 백엔드 연결

- 개발 시 기본값은 `/api/v1/*` 요청을 Vite dev 서버가 `http://localhost:8080` (Kotlin 백엔드)로 proxy
- CORS를 직접 검증하거나 다른 백엔드 포트에 붙일 때는 `VITE_API_BASE_URL=http://localhost:<port>/api/v1` 로 실행
- 프로덕션에선 Caddy가 프론트 정적 번들 + `/api/v1/*` 백엔드 프록시를 같은 origin으로 합침 → **CORS 불필요**

## 구조

```
src/
├── api/
│   ├── client.ts       # 공통 fetch 래퍼 (baseURL = VITE_API_BASE_URL 또는 /api/v1)
│   └── types.ts        # ApiError + ApiValue/List/PageResponse 표준 DTO 타입
├── main.tsx            # TanStack Query Provider 세팅
└── App.tsx
```

## API 응답 규칙

- 단건: `api<T>('/path')` 또는 `apiValue<T>('/path')` → 백엔드 `{ value, meta }`에서 `value` 반환
- 리스트: `apiList<T>('/path')` → 백엔드 `{ values, meta }`에서 `values` 반환
- 페이지: `apiPage<T>('/path')` → 백엔드 `{ values, pagination, meta }` 전체 반환
- 응답 메타까지 직접 다뤄야 하면 `apiEnvelope<TEnvelope>('/path')` 사용

## 사용법

이 레포는 **GitHub Template**. 새 프로젝트 시작:

1. GitHub 레포 페이지 → **Use this template**
2. 또는 `gh repo create <name> --template sumin/react-skeleton --private`

## Vite → Next.js 전환 고려 시

SSR/SEO 요구가 실제로 생긴 앱은 이 스켈레톤 대신 별도 `react-next-skeleton` 기반으로 시작. 기존 Vite 앱 강제 이주는 안 함. 배경/전환 비용 설명은 `homeserver/docs/SETUP.md` Step 9 참고.
