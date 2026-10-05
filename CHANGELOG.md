# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — `@skeleton/i18n` · `@skeleton/ui` 설정/오류 부품 5개 + `LanguageMenu` · SSE 클라이언트 하드닝 (2026-10-06)

Ovation 웹의 일반화할 수 있는 아이디어를 스켈레톤 규칙(토큰 · prop 문구 · 스토리 + play · SSR 안전)에 맞게 다시 만들었다 — 파일을 옮기지 않았고 Ovation 이름 · 저장 키 · 문구는 없다.

- **`@skeleton/i18n`**(새 패키지, 외부 의존 `intl-messageformat` · `@formatjs/icu-messageformat-parser`): `createI18n({ catalogs, defaultLocale, storageKey })` — ICU 메시지(`t` · `tIn` · 요소가 낀 `tRich`), 언어 감지(저장한 선택 → `navigator.languages`(전체 태그 → 주 태그) → 기본)와 저장, 지연 사전(`en: () => import('./en')`, 도착한 뒤에 바뀜 · 늦게 부른 호출이 이김), 서버 렌더 안전(만들 때 브라우저 API 를 읽지 않는다, 첫 렌더는 기본 언어, `init()` 은 브라우저에서 명시적으로), 없는 키는 기본 언어 문구 → 키(+`onMissingKey`). `I18nProvider` · `useT()` · `detectLocale`. 테스트 도구 `@skeleton/i18n/testing` 의 `catalogProblems(catalogs, { defaultLocale })`(같은 키 · ICU 로 읽힘 · 인자 일치 · ICU 문법 옆 ASCII 아포스트로피 · 빈 문구)를 앱이 자기 테스트에서 부른다. 부품(`@skeleton/*`)은 i18n 을 모르고 라벨은 계속 prop — 앱이 번역해 넘기는 법은 `packages/i18n/README.md`. 스토리 `Packages/i18n`
- **`@skeleton/ui`**: `LanguageMenu`(i18n 라이브러리를 모르는 순수 부품이라 ui 에 둔다 — 자기 말로 쓴 선택지 · `lang` 속성), `RowMenu`(WAI-ARIA 메뉴 버튼: ↑↓ Home End · Esc · 바깥 클릭 · 포커스 돌려주기 · 위로 열기), `SwitchRow`(줄 전체가 라벨인 설정 스위치 · `busy`), `SectionCard`(접이식 절) + `SectionIndex`(절 목차 · 포커스 이동 · 현재 절), `ErrorReference`(참조 번호 + 복사 · `role="status"`). 스토리 + `play` + 카탈로그 + SSR fixture. 설정 Pattern 이 목차 · `SwitchRow` · 접이식 기기 목록 + `RowMenu` · 저장 실패 시 참조 번호를 보인다
- **`showApiError`**: 참조 번호(traceId)를 **돌려준다** — 상태에 담아 `<ErrorReference reference=… />` 로 그리면 토스트가 사라진 뒤에도 남는다. 토스트의 traceId 는 클릭 전용 `div` 가 아니라 키보드로 닿는 복사 버튼이 되었다(`messages.copy` 추가)
- **`@skeleton/realtime` `createSseClient`**: 탭이 숨겨지면 끊고(`paused`) 보이면 곧바로 잇는다 · `idleTimeoutMs`(기본 꺼짐 — 서버 심장박동 주기보다 길게 줄 때만) · 401 · 403 · 404 는 `off` 로 영구 중지 · 429 · 503 은 `busyDelayMs`(30초) 뒤에, `Retry-After` 가 더 길면 그만큼(상한 `maxRetryAfterMs`) · `onOpen({ reconnect })`. `RealtimeStatus` 에 `paused` · `off` 가 더해졌다(SSE 만 낸다)
- **`apps/sample`**: 글자를 `src/strings.ts` 에서 `src/i18n/ko.ts` + `en.ts`(지연)로 옮겼다 — 헤더에 언어 메뉴, 언어를 바꾸면 그 자리에서 다시 그리고 `notes:ui-locale` 에 저장. 카탈로그 짝 맞춤 테스트. 불러오기 실패 카드에 참조 번호 + 복사. `scripts/new-project.sh --packages i18n` 이 되고(샘플이 쓰므로 `--with-sample` 은 자동), `test-new-project.sh` 조합 2 가 i18n 을 포함한다
- **바뀐 동작(호환 주의)**: 503 은 더는 빠른 재시도가 아니라 느린 재시도(`createSseClient`) · `showApiError` 토스트의 traceId 마크업이 바뀌었다(`traceId: <id>` 한 글자열 → 이름 · 번호 · 복사 버튼)

### Added — 참조 앱 `apps/sample`(Notes) · `@skeleton/ui` 5부품 · Dashboard Pattern · 브라우저 e2e (2026-10-05)

"이 스켈레톤으로 이런 제품이 나온다"를 한 화면 흐름으로 보이는 작은 실제 앱. 로그인 → 대시보드(현황 · 최근 노트 · 안 읽은 알림) → 목록(검색 · 필터 · 쪽 · 빈/로딩/오류) → 상세(탭 · 삭제 확인) → 만들기/수정(백엔드 400 을 칸별로) → 첨부 업로드(진행률) → 알림 종 + 실시간 → 설정(테마 · 계정) → 로그아웃. 백엔드 짝은 kotlin-skeleton `apps/sample`(`/api/v1/notes`).

- `apps/sample` — Patterns 를 조립한 화면(화면 → Pattern 지도와 조립 메모는 `apps/sample/README.md`), 글자는 `src/strings.ts` 한 곳, 서버 상태는 TanStack Query(`notes/queries.ts`), HTTP 는 `notes/notesApi.ts` 한 곳, 목록 조건은 주소 검색 인자(`listParams.ts`), 만들기는 요청 내용마다 `Idempotency-Key`(같은 내용 재전송은 같은 키, 고쳐 보내면 새 키 — 서버는 같은 키 다른 본문에 409). 단위 테스트(API 모양 · 쿼리 키 · 폼 오류 매핑 · 업로드 문구 · 주소 인자 · 라우트 가드)
- 브라우저 e2e `pnpm e2e:sample`(Playwright + vitest, 새 의존 없음) — `e2e/globalSetup.ts` 가 kotlin-skeleton `scripts/sample-e2e-backend.sh` 로 DB · 로컬 S3 · 백엔드를 빈 포트에 올리고 Vite 를 띄운 뒤 끝나면 모두 내린다. CI `sample-e2e` 잡(타임아웃 30분). `E2E_WALKTHROUGH=1 pnpm --filter sample walkthrough` 는 여정 스크린샷 · 녹화
- `@skeleton/ui` 새 부품: `PageHeader` · `Badge` · `Progress` · `FilePicker`(날 `<input type=file>` 이 금지라) · `Stat` — 스토리 + `play` + SSR fixture. `AppShell` 이 현재 링크(`aria-current="page"`)를 칠하고 좁은 화면(≤640px)에서 메뉴가 둘째 줄로 내려간다(컨테이너 쿼리, props 불변). `Button` 라벨이 줄바꿈하지 않는다. `Dialog` 의 머리 · 바닥은 `<header>` · `<footer>` 가 아니라 `<div>`(대화상자 안에서는 최상위가 아닌 banner · contentinfo 랜드마크가 되어 axe 가 지적했다)
- 새 Pattern `Patterns/Dashboard page`(숫자 4칸 + 최근 항목 표 + 알림 카드 · 로딩 · 오류 · 첫 사용). 목록 · 상세 · 폼 · 설정 Pattern 이 `PageHeader` 로 시작한다
- `@skeleton/api-client`: `client.noContent(path, request)` — 204(백엔드 `Response.noContent()`: 삭제 · 명령 완료)는 본문이 없어 `basic` 이 검증에 실패했다. `@skeleton/theme`: `ThemedToaster({ position })`(기본 `top-right` 그대로, 헤더 액션을 덮지 않게 `bottom-right`)
- `scripts/new-project.sh`: 샘플은 **기본으로 넣지 않는다**, `--with-sample` 이면 남긴다(이름 `sample` 예약). 루트 스크립트 `dev:sample` · `e2e:sample`, CLAUDE.md 「새 기능의 정본 예시」

### Changed — 백엔드 모듈이 받은편지함 · 업로드 HTTP 를 연다: 기본 경로가 생겼다 · 풀스택 한 줄 실행 (2026-10-05)

새 프로젝트 드릴(스켈레톤 두 개로 찍어 브라우저에서 알림 · 업로드 · 잡 · 시간 · 인증을 눌러 봄)에서 앱이 직접 써야 했던 컨트롤러(받은편지함 142줄 · presign 70줄)를 kotlin-skeleton 모듈로 옮겼고, 패키지는 그 경로를 기본으로 한다.

- `@skeleton/storage`: `storageEndpoints(basePath = '/storage')`(모듈의 `/api/v1/storage/*` 전부) · `createStorageApi(client)` 의 `endpoints` 기본값이 그것 — 한 줄로 presign · validate · download · multipart 가 모두 생긴다. 새 `download` 엔드포인트 → `api.presignDownload(key)` · `publicUrlFromDownload(api)`(비공개 버킷에 올린 파일을 짧은 수명 GET 주소로 연다). 기존 `endpoints` 를 직접 주는 호출은 그대로 동작한다
- `@skeleton/notifications`: 기본 `basePath`(`/notifications`)는 그대로이고, 이제 그 경로를 워크벤치 데모가 아니라 백엔드 `modules/notification` 이 연다(README · 주석)
- `@skeleton/api-client`: `ErrorCodes` 에 `STORAGE_FILE_REJECTED`(`data.errors` 에 사유) · `STORAGE_OBJECT_NOT_FOUND` · `STORAGE_UNAUTHENTICATED`
- `scripts/new-project.sh`: 레포 안에서 `../내-프로젝트` 처럼 상대 경로로 부르면 "target must be outside the skeleton repo" 로 거부되던 것을 고쳤다(경로를 정리한 뒤 비교)
- 앱(`starter` · `workbench`): Vite proxy 목적지를 `API_PROXY_TARGET` 으로 바꿀 수 있다(기본 `http://localhost:8080`)
- README 「백엔드와 나란히」: 작업 폴더에 `api` · `web` 으로 두고 백엔드 `scripts/dev.sh` 로 DB · 로컬 S3 · 백엔드 · 이 프론트를 한 번에 띄운다. `new-project.sh` 의 안내도 같다

### Added — Storybook: 스토리가 부품의 정본(보이는 모습 · 정본 사용법 · 실행되는 테스트)

- `apps/storybook`(Storybook 10 · `@storybook/react-vite` · Vite 8 에서 그대로 동작) — 설정 `.storybook/`(토큰 · `base.css` 로드, 도구 모음의 라이트/다크 스위치 = `<html data-theme>`, autodocs, a11y 위반이 실패인 `a11y: { test: 'error' }`), **Patterns** 6개(목록 · 폼 · 상세 · 로그인 · 403 · 설정 — `@skeleton/ui` 만으로 짠 복사용 한 파일 화면 틀, 도우미 파일 없음, 다크 변형 포함), 토큰 문서(`tokens.json` 에서 읽은 색 · 간격 · 모서리 · 글자 크기 · 그림자, 라이트 · 다크 나란히 — 쇼케이스의 토큰 페이지를 옮김)
- 스토리는 부품 옆(`packages/*/src/**/*.stories.tsx`, CSF3 · `satisfies Meta`): `@skeleton/ui` 의 모든 export(상태별 + `play` — 클릭 · 키보드 · 포커스 링 · 라벨/오류 연결 · 탭 화살표 · 다이얼로그 Esc 와 포커스 복귀 · 쪽 이동 끝), `theme` · `notifications` · `captcha-turnstile` · `auth`(`RequireAuth`) · `storage`(`useUpload`) · `time`. 가짜(받은편지함 · Turnstile · 인증 · 업로드 전송)는 각 패키지의 `src/stories/`(쇼케이스의 `fakes/` 를 옮김)
- 루트 스크립트 `storybook` · `storybook:build` · `test:stories`(진짜 브라우저 headless — Vitest 애드온 + Playwright chromium). `pnpm test` 는 그대로 빠른 단위 테스트. CI 에 `stories` 잡(브라우저 캐시 · 타임아웃)
- ESLint(`apps/**`): 날 `<button>` · `<input>` · `<select>` · `<textarea>` · `<dialog>` 와 인라인 style 의 색 · 간격 · 모서리 · 글자 크기 날값을 막고, 메시지가 대신 쓸 `@skeleton/ui` 부품을 말한다. `packages/ui` 와 다른 패키지는 제외, `apps/workbench` 는 명시적 예외(`UI_ONLY_EXEMPT`)
- 루트 테스트 `tests/stories.test.ts`(모든 `@skeleton/ui` export 에 스토리 + `play` · 모든 스토리가 CSF3 · 모든 Patterns 가 CLAUDE.md 안내에 적힘 + `@skeleton/ui` 만 import · `docs/ui-catalog.md` 일치) · `tests/eslint.uiOnly.test.ts`. 의존 규칙: 스토리(`*.stories.tsx` · `src/stories/`)는 테스트 쪽 파일로 세어 devDependencies · 루트 Storybook 도구로 충분
- `docs/ui-catalog.md`(부품 → 스토리 → 언제 쓰는가) · CLAUDE.md 의 「UI 를 만들기 전에」(스토리 먼저 · Patterns 에서 시작 · 날 요소/값 금지 · 부품을 바꾸면 스토리 + play)
- `scripts/new-project.sh`: 스토리집 · 남는 패키지의 스토리 · Patterns · 카탈로그 · 에이전트 안내 · CI 잡이 **기본으로 따라온다**, `--without-storybook` 이면 깨끗이 뗀다. `test-new-project.sh --full` 의 조합 2 가 `storybook:build` · `test:stories` 를 돈다

### Changed

- **`apps/showcase` 를 없앴다** — 부품 상태는 스토리로, 토큰 페이지는 `apps/storybook` 으로, 가짜는 각 패키지의 `src/stories/` 로 옮겼다(시간 포맷 표는 `time` 스토리로). api-client · payment · realtime 데모(컴포넌트가 없는 패키지)는 옮기지 않았다 — 각 패키지 README 가 있다. `pnpm dev:showcase` · `new-project.sh --with-showcase` 는 없어졌다(`--with-showcase` 는 안내와 함께 exit 2)
- `auth` · `captcha-turnstile` · `storage` · `theme` · `time` 이 스토리에서 `@skeleton/ui` 를 쓰므로 devDependency 로 선언하고(`auth` · `captcha-turnstile` · `storage` · `time` 은 tsconfig `types: ["vite/client"]` — ui 의 CSS Modules 타입), 루트 devDependencies 에 Storybook · `@vitest/browser-playwright`(vitest 와 같은 버전) · `playwright`
- 이름 `storybook` · `storybook-app` 은 앱 이름으로 예약

### Added — 서버 렌더 스타터 · 쇼케이스 · SSR 안전

- `apps/starter-ssr` — 서버가 첫 응답을 그리고 브라우저가 이어받는 스타터(plain Vite SSR: `server/` Node 서버 · `src/entry-server.tsx` · `src/entry-client.tsx`, 새 런타임 의존 없음). 홈(`GET /hello` 를 서버가 시간 제한 안에 가져와 TanStack Query `dehydrate`/`hydrate` 로 넘김 — 백엔드가 죽으면 데이터 없이 200) · 로그인 · 보호 `/account`(토큰은 브라우저에만 — 서버는 중립 자리 표시, `createDeferredTokens`) · 404(실제 상태 코드), 라우트별 `<title>` · 설명(`handle`), 테마 스크립트가 `<head>` 맨 앞. `pnpm --filter starter-ssr dev|build|start`, Dockerfile(런타임에 node_modules 없음). 테스트: 서버 렌더 · 하이드레이션 마크업 일치 · 핸들러 · 빌드한 서버를 띄우는 통합 테스트
- `apps/showcase` — (이후 Storybook 으로 대체되어 없어졌다 — 위 Unreleased 참고)
- `scripts/new-project.sh --ssr`(`apps/starter-ssr` 를 앱으로) · `--with-showcase`(`apps/showcase` 유지). `scripts/test-new-project.sh --full` 에 `--ssr --with-showcase` 조합 추가
- 루트 테스트 `tests/ssr.safety.test.ts` — 모든 패키지 entry 가 브라우저 전역 없는 Node 에서 import 되고(import 시점에 아무것도 건드리지 않음), export 한 모든 컴포넌트 · 훅이 서버에서 경고 없이 그려진다(목록은 `exports` 에서 만들어 새 export 를 잊을 수 없다)
- `@skeleton/theme`: `initTheme()` · `getServerTheme()`
- `@skeleton/tokens`: 테마 속성이 `<html>` 만이 아니라 아무 요소에서나 동작(`:root, [data-theme='light']` · `[data-theme='dark']`) — 라이트 · 다크를 나란히 보일 수 있다

### Changed (SSR 안전)

- **`@skeleton/theme` 는 import 시점에 저장소를 읽거나 `<html>` 을 건드리지 않는다.** 앱 진입점이 `initTheme()` 을 불러야 한다(`apps/starter` · `apps/workbench` 는 이미 부른다; 루트 테스트가 확인). `useTheme` 의 서버 스냅샷은 항상 `system`(하이드레이션 일치)
- 루트 devDependencies 에 `react` `react-dom` `react-router-dom` `@tanstack/react-query`(SSR 안전 테스트용)
- `tokens.css` 의 `html[data-theme='dark']` 셀렉터가 `[data-theme='dark']` 로 — `pnpm tokens` 로 다시 생성

### Added — 프론트 조각 보강 · 프로젝트 찍기

- **새 패키지 4개** (각자 `package.json` · 테스트 · README, 서로는 이름으로만):
  - `@skeleton/notifications` — 받은편지함 클라이언트(`GET /notifications` 페이지 · `PATCH …/{eventId}/read` · `PATCH …/read-all`, 경로는 `basePath`) · TanStack Query 훅 · 안 읽은 수(= `unreadOnly&size=1` 의 `totalElements`) · `useNotificationIngest` 로 `@skeleton/realtime` 이벤트를 캐시에 반영(중복 id 한 번만) · `NotificationBell`/`NotificationList`
  - `@skeleton/storage` — 프리사인 업로드: 클라이언트 검증(백엔드 `StorageFileValidator` 와 같은 규칙 · 코드) → presign → XHR 직접 PUT(진행률 · 취소) → 키(+ 공개 주소), 큰 파일 멀티파트(조각 presign · 동시성 · ETag · 실패/취소 시 abort) · `useUpload`. 백엔드 모듈이 HTTP 를 열지 않아 경로는 `endpoints` 로 받는다(기본 경로 없음)
  - `@skeleton/payment` — `PaymentContracts` 타입 · `createPaymentApi`(준 경로만) · `confirmRequestFromTossRedirect` · `isPaymentError`. 모듈 계약이 얇아 결제 흐름은 만들지 않았다(README 에 한계)
  - `@skeleton/captcha-turnstile` — `loadTurnstile`(한 번만 · 재시도) · `<Turnstile>` · `useTurnstileToken` · `attachTurnstileToken`(`cf-turnstile-response`)
- `@skeleton/auth`: 소셜 로그인 도우미 — `buildAuthorizeUrl`(google · kakao · naver 프리셋) · `createSocialLoginFlow`(state 보관 · 검증 · 한 번만 → `socialLogin(provider, code, redirectUri)`) · `parseSocialCallback` · `useSocialLoginCallback`
- `@skeleton/ui`: `Textarea` `Checkbox` `Switch` `Tabs`(WAI-ARIA · roving tabindex · 화살표/Home/End) `Table` `Pagination`(0 기반 `PaginationMeta`) `EmptyState` · `toastPromise`(로딩 → 성공/실패가 한 토스트에서)
- `@skeleton/tokens`: 간격(`--space-xs…3xl`) · 모서리(`--radius-sm…full`) · 글자 크기/줄 높이(`--font-size-caption…title` · `--line-height-*`) 토큰(원시 → 의미) + 테스트 도구 `findRawLayout`
- `scripts/new-project.sh <target-dir> <name> [--packages a,b,c] [--with-workbench] [--scope @acme]` — 복사 → 필요한 패키지만(스타터가 쓰는 것 + `--packages` 의 의존 닫힘) → `apps/starter` 를 `apps/<name>` 으로 → 루트 `package.json` · eslint · 문서 → (선택) 스코프 바꾸기. `scripts/test-new-project.sh --quick`(`pnpm test` 가 부름) · `--full`(세 조합을 찍어 install · lint · typecheck · test · build — `.github/workflows/new-project.yml`)
- `apps/workbench`: `/packages` 예제 화면(`src/modules/demos`) · `apps/starter` 404 페이지는 `EmptyState`
- 루트 테스트: 간격 · 모서리 · 글자 크기 날값 금지(`tests/usage.test.ts`), 이 레포의 앱 · 패키지 목록은 `tests/skeleton.repo.test.ts` 로 분리(찍을 때 지워진다) — 일반 규칙(`workspace` · `usage` · `contrast`)은 이름을 하드코딩하지 않는다

### Changed

- `@skeleton/ui` · `theme` · starter 의 CSS 는 간격 · 모서리 · 글자 크기에 토큰만 쓴다. 4px 격자에 없던 6 · 10 · 14px 은 가까운 단계로 맞췄다(안쪽 여백이 최대 2px 달라짐), 제목 `line-height` 1.15 · 1.2 · 1.25 → 1.2(`tight`), `code` · `pre` 1.35 · 1.45 → 1.35(`snug`). 예외: `apps/workbench` CSS(토큰으로 옮기려면 540줄 — `tests/support/layoutExempt.ts` 가 명시한다)
- 루트 `pnpm test` 가 `scripts/test-new-project.sh --quick` 도 돈다

### Migration — 단일 Vite 앱 → pnpm 워크스페이스 (앱 2 + 패키지 7)

기존 프로젝트(이 스켈레톤에서 시작한 레포)가 이 변경을 가져올 때의 옮김표. 백엔드 `modules/` 처럼 프로젝트가 필요한 패키지만 한 줄(`"@skeleton/<이름>": "workspace:*"`)로 골라 쓴다.

| 예전 위치                                                                           | 지금 위치                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 앱 전체(`src/` · `index.html` · `vite.config.ts` · `public/`)                       | `apps/workbench/`(데모 그대로) · `apps/starter/`(복사해 가는 출발점)                                                                                                                 |
| `src/api/{types,errorCodes,traceContext}.ts` · `src/modules/http/*`                 | `@skeleton/api-client` — `createSkeletonHttpClient({ baseURL })` → `createApiClient({ baseUrl })`                                                                                    |
| `src/api/client.ts`(`api` · `apiList` … 전역 함수 + `import.meta.env`)              | 앱의 `src/api/` (패키지는 `import.meta.env` 도 싱글턴도 없다). 환경변수는 `apiConfigFromEnv(import.meta.env)`                                                                        |
| `accessToken` · `devLogin` · `breakGlass` 요청 옵션                                 | `headers` + `@skeleton/auth` 의 `requestAuthHeaders(...)` / `getAuthHeaders` · `skipAuth`. (워크벤치는 요청 옵션 그대로 받는 얇은 어댑터를 `apps/workbench/src/api/client.ts` 에 둠) |
| `src/modules/auth/authSession.ts`                                                   | `@skeleton/auth`(`parseDevIdentity` · `applyAuthHeaders` · `decodeTokenPrincipal` 그대로)                                                                                            |
| `src/modules/notifications/*` + HomePage 안의 SSE/STOMP 코드                        | `@skeleton/realtime`                                                                                                                                                                 |
| `src/lib/time/*`                                                                    | `@skeleton/time`                                                                                                                                                                     |
| `src/lib/theme.ts` · `ThemeToggle` · `ThemedToaster` · `index.html` 인라인 스크립트 | `@skeleton/theme`(스크립트는 `@skeleton/theme/vite` 의 `themePrePaint()` 플러그인이 `<head>` 에 넣는다)                                                                              |
| `design/tokens/*` · `src/styles/tokens.css`                                         | `packages/tokens/{tokens.json,build.mjs,tokens.css}` — `pnpm tokens` · `pnpm tokens:check` 는 루트에서 그대로                                                                        |
| `src/index.css`                                                                     | `@skeleton/ui/base.css`(리셋 + 요소 타이포) + `apps/workbench/src/workbench.css`(워크벤치 전용)                                                                                      |
| `src/components/ErrorBoundary.tsx` · `src/lib/showApiError.tsx`                     | `@skeleton/ui` — 문구는 prop(기본 영어). 워크벤치는 한국어 문구를 넘긴다                                                                                                             |
| `src/styles/{contrast,usage}.test.ts` · `src/test/*`                                | 루트 `tests/` (두 앱 + 모든 패키지를 훑음) · 도구는 `@skeleton/tokens`                                                                                                               |
| `.env` · `.env.example`                                                             | 각 앱 폴더(`apps/*/.env`) — Vite 가 앱 폴더에서 읽는다                                                                                                                               |

- 루트 명령은 그대로: `pnpm lint` · `tokens:check` · `typecheck` · `test` · `format:check` · `build`(이제 워크스페이스 전체). 새로: `pnpm dev`(= starter) · `pnpm dev:workbench`.
- CI 의 Node 를 24 로(`vite.config.ts` 가 `@skeleton/theme/vite` 의 `.ts` 를 Node 로 직접 읽는다 — 22.18+ 도 가능).

### Added

- `pnpm-workspace.yaml`(`apps/*` · `packages/*`) · `tsconfig.base.json` · 단일 `eslint.config.js`(경계 규칙: `@skeleton/*/src/**` 딥 임포트 금지, 패키지/앱이 앱 코드 import 금지)
- 패키지 7개(`@skeleton/api-client` `auth` `realtime` `time` `theme` `tokens` `ui`) — 각자 `package.json`(`exports` = `src/index.ts`, 소스 수준 해석, 빌드 단계 없음) · 옆 테스트 · `README.md`
- `@skeleton/api-client`: `createApiClient(config)`(baseUrl · timeoutMs · retry · `getAuthHeaders` · `getTimeZone` · `onResponseDate`(서버 시각 연결점) · `onError` · `debug`), `apiConfigFromEnv`, 요청 옵션 `skipAuth`
- `@skeleton/auth`: 토큰 저장소(메모리 + 주입하는 storage) · `createAuthApi`(`login` · `me` · `socialLogin(provider, authorizationCode, redirectUri)` — 백엔드 `/auth/login` · `/auth/me` · `/auth/social/{provider}/login`) · `createAuthSession` · `AuthProvider`/`useAuth` · `<RequireAuth>` · dev-login/break-glass 헤더 helper · `createAuthHeadersProvider` · `createUnauthorizedHandler`(401 연결점)
- `@skeleton/realtime`: `createSseClient`(fetch streaming) · `createStompNotificationClient`(WebSocket + STOMP 프레임, 재연결 정책) · `useSseClient` · `useNotificationSocket`
- `@skeleton/ui`: `Button` `Input` `Field` `Select` `Card` `Dialog` `Spinner` `AppShell`(CSS Modules, 의미 토큰만, 문구는 prop)
- `@skeleton/tokens`: 출력 경로가 옵션(`build({ root, source, cssOut, docOut })` · `--source` `--css` `--doc`), 문서 표 생성은 `docOut` 을 줄 때만
- `apps/starter`: 라우터(홈 · 로그인 · `RequireAuth` 아래 `/account` · 404) · `AppShell` + `ThemeToggle` · `VITE_*` 환경변수 배선 · `QueryClient` + 에러 토스트 · `GET /hello` 예시 훅
- 루트 `tests/`: 선언한 `@skeleton/*` 의존 = 소스 import(= 패키지를 지울 수 있다) · `starter` 가 워크벤치에 의존하지 않음 · 외부 import 선언 · 패키지의 `import.meta.env` 금지 · ESLint 경계 규칙 · 토큰 사용 검사가 두 앱 + 모든 패키지를 덮음
- 모든 앱 · 패키지에 `typecheck` 스크립트(루트 `pnpm typecheck` 가 전부 돈다)

### Changed

- 워크벤치의 SSE/WebSocket 연결을 `@skeleton/realtime` 훅으로 교체(UI · 호출 엔드포인트 동일). 화면 로그 변환은 `apps/workbench/src/modules/workbench/realtimeExchanges.ts` 로 분리(테스트 추가)
- 패키지 tsconfig 는 `types: []` — 패키지에서 `import.meta.env` 를 쓰면 타입 에러

### Fixed

- SSE · WebSocket 시작 버튼이 클릭 이벤트를 `attempt` 인자로 받던 문제: 수동 시작 때 이벤트 목록이 비워지지 않고, 첫 재연결 지연이 `NaN`(즉시)이던 것을 설계대로(목록 비움 · 1s 지수 백오프)로. 상태는 바뀔 때만 보고
- `createQueryClient`(starter): 캐시 `onError` 가 넘기는 추가 인자(query · mutation …)가 토스트 핸들러로 새지 않게 에러만 전달

> 아래 `Changed` · `Added` · `Fixed` 는 워크스페이스 전환 이전부터 쌓여 있던 Unreleased 항목이다.

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
