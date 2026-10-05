# react-skeleton — Claude Code 컨텍스트

React + TypeScript + Vite 프론트엔드 스켈레톤. pnpm 워크스페이스 — 캡슐화된 패키지 15개 + 앱 5개(SPA 스타터 · SSR 스타터 · 참조 앱 샘플 · 스토리집 · 워크벤치). REST 백엔드(kotlin-skeleton)와 통신하는 SPA 출발점이고, 백엔드 `modules/` 처럼 프로젝트가 필요한 패키지만 한 줄씩 골라 쓴다.

<!-- storybook-guide:start -->

## UI 를 만들기 전에 (에이전트 필독 — 스토리가 정본이다)

화면을 짤 때마다 결과가 달라지지 않도록 **보고 따라 할 정본**이 있다 — Storybook(`pnpm storybook` → http://localhost:6006). 부품마다 스토리 하나가 「보이는 모습 · 정본 사용법 · 실행되는 테스트(`play`)」이고, 테스트가 돌기 때문에 낡지 않는다.

1. **부품을 쓰기 전에** `docs/ui-catalog.md` 에서 그 부품의 스토리 파일을 찾아 읽고, 거기 있는 사용법(`Field` 안에 `Input`, `Table` 의 `empty` …)을 그대로 따른다. 카탈로그에 없는 부품은 만들기 전에 있는 것으로 되는지부터 본다.
2. **새 화면은 `Patterns/…` 스토리에서 시작한다** — 가장 가까운 것을 복사해 문구 · 데이터 연결만 바꾼다(아래 표). 처음부터 짜지 않는다. 패키지가 자기 Patterns 를 들고 올 수도 있다(예: 공개 페이지용 `@skeleton/marketing` 의 랜딩 · 요금제 · 약관 · 404 — `docs/ui-catalog.md` 의 Patterns 표가 정본).
3. **날 요소 · 날값 금지** — `<button>` `<input>` `<select>` `<textarea>` `<dialog>` 대신 `@skeleton/ui` 의 `Button` `Input`(+`Field`) `Select` `Textarea` `Dialog`, 인라인 style 의 색 · 간격 · 모서리 날값 대신 의미 토큰(`var(--space-md)`). `apps/**` 에서 ESLint 가 메시지와 함께 막는다(`packages/ui` 안은 부품을 만드는 곳이라 제외).
4. **부품을 더하거나 바꾸면 스토리를 더하거나 고치고 `play` 로 동작을 검증한다**(클릭 · 키보드 · 라벨 연결 · 상태). `pnpm test:stories`(진짜 브라우저)가 통과해야 한다 — 접근성(a11y) 위반도 실패다. 규칙을 끄려면 그 스토리 옆에 이유를 적는다.
5. **스토리 파일을 더하거나 지우면** `docs/ui-catalog.md` 표에 한 줄을 더하거나 지운다(`tests/stories.test.ts` 가 어긋남을 막는다). `@skeleton/ui` 가 새로 export 하는 것은 `packages/ui/src/<폴더>/` 에 스토리(+`play` 하나 이상)가 있어야 한다.

| Patterns  | 파일                                                    | 복사하는 때                                                               |
| --------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| 대시보드  | `apps/storybook/src/patterns/DashboardPage.stories.tsx` | 숫자 4칸 + 최근 항목 표 + 알림 카드 · 로딩 · 오류 · 첫 사용               |
| 목록      | `apps/storybook/src/patterns/ListPage.stories.tsx`      | 표 + 쪽 이동 + 빈 상태 + 로딩 + 오류                                      |
| 폼        | `apps/storybook/src/patterns/FormPage.stories.tsx`      | 입력 · 검증 오류 · 제출 중 · 성공 · 실패                                  |
| 상세      | `apps/storybook/src/patterns/DetailPage.stories.tsx`    | 제목 + 탭 + 위험 구역(삭제 확인) · 로딩 · 없음                            |
| 로그인    | `apps/storybook/src/patterns/LoginPage.stories.tsx`     | 이메일 · 비밀번호 · 제출 중 · 잘못된 계정 정보                            |
| 권한 없음 | `apps/storybook/src/patterns/ForbiddenPage.stories.tsx` | 403 화면                                                                  |
| 설정      | `apps/storybook/src/patterns/SettingsPage.stories.tsx`  | 목차 + 즉시 적용 스위치 + 저장 폼(실패 시 참조 번호) + ⋯ 메뉴 + 위험 구역 |

<!-- storybook-guide:end -->

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
│   └── src/routes/           # routes.tsx(path → page) · index.tsx(router) · Home · Login · Account(RequireAuth 아래) · NotFound(EmptyState)
├── starter-ssr/              # SSR 스타터(같은 페이지, 서버가 첫 응답을 그린다 — 머리(canonical · OG · robots)는 @skeleton/seo, SITE_URL 이 공개 주소, 빌드가 sitemap.xml · robots.txt — 워크벤치 코드 없음)
│   ├── server/               # Node 서버: main.ts(개발=Vite 미들웨어 · 프로덕션=dist) · handler.ts(정적 · 상태 코드) · config.ts(env) · contract.ts
│   ├── src/entry-server.tsx  # render(url,{api}) — 라우트 맞추기(404) → handle.prefetch → renderToString → head(title · 설명 · dehydrate 상태)
│   ├── src/entry-client.tsx  # initTheme → readSsrState → hydrateRoot(createClientApp) ; src/app/ AppProviders · AppRoutes(서버 · 브라우저 공유)
│   ├── src/auth/             # createDeferredTokens(저장소 읽기를 하이드레이션 뒤로) · ClientRequireAuth(서버는 중립 자리 표시)
│   └── src/routes/routes.tsx # 라우트마다 handle { title, description, robots, prefetch } ; Dockerfile(런타임에 node_modules 없음)
├── sample/                   # 참조 앱 Notes(`new-project.sh --with-sample` 일 때만 따라간다): 랜딩(로그아웃 상태의 `/` — 요금제 · FAQ · 동의 배너 · 푸터) → 약관 · 방침(템플릿) → 로그인 → 대시보드 → 목록 → 상세 → 폼 → 첨부 업로드 → 알림 → 게시판(글 · 대댓글 · 공감 같은 반응) → 설정 · 404, Patterns 를 조립한 실제 제품 모양(화면마다 `handle.seo`). 백엔드 짝은 kotlin-skeleton `apps/sample`
├── storybook/                # 스토리집(Storybook 10 · Vite): .storybook/(설정 · 라이트/다크 스위치 · a11y 실패 규칙) · src/patterns/(복사해서 시작하는 화면 틀 6개) · src/tokens/(토큰 문서). 부품 스토리는 부품 옆(packages/*/src/**/*.stories.tsx)
└── workbench/                # 백엔드 확인용 시각적 테스트 벤치(HomePage · modules/workbench · workbench.css) + modules/demos(`/packages` 예제 화면: 새 패키지를 눌러 본다)
packages/                     # 서로를 이름으로만 부른다. 각자 package.json(exports=src/index.ts) · 테스트 · README
├── api-client/               # createApiClient(config) · ApiRequestError · ErrorCodes/isErrorCode · createTraceContext · newIdempotencyKey · apiConfigFromEnv
├── auth/                     # createTokenStore · createAuthApi · createAuthSession · AuthProvider/useAuth/RequireAuth · createSocialLoginFlow(소셜 로그인 도우미) · dev-login/break-glass 헤더 · 401 훅
├── realtime/                 # createSseClient(탭 숨김 일시정지 · 유휴 감시 · 401/403/404 중지 · 429/503 느린 재시도 · onOpen) · createStompNotificationClient · useSseClient · useNotificationSocket · 재연결 정책
├── i18n/                     # createI18n(ICU · 감지 · 저장 · 지연 사전) · I18nProvider/useT · detectLocale · @skeleton/i18n/testing(catalogProblems) — 부품은 i18n 을 모르고 라벨은 prop, 앱이 번역해 넘긴다
├── notifications/            # createNotificationsApi(목록 · 읽음 · 모두 읽음) · useNotifications/useUnreadCount/useMarkRead · useNotificationIngest(실시간 → 캐시) · NotificationBell/List
├── board/                    # createBoardApi · useBoardConfig/usePosts/usePost/useComments/글·댓글 쓰기 · useReaction(낙관적 갱신 + 되돌리기) · nestThread · PostList/PostDetail/PostEditor/CommentThread/ReactionBar(+ 서버와 이은 BoardComments/PostReactionBar). 반응 종류는 서버가 알려 주는 코드, 문구 · 아이콘은 labels/icons 맵 prop
├── storage/                  # createStorageApi · createUploader(검증 → presign → 직접 PUT, 멀티파트) · useUpload · validateFile
├── payment/                  # PaymentContracts 타입 · createPaymentApi(경로는 앱이 준다) · confirmRequestFromTossRedirect — 일부러 얇다
├── captcha-turnstile/        # loadTurnstile · <Turnstile> · useTurnstileToken · attachTurnstileToken
├── seo/                      # buildHeadSpec(제목 템플릿 · 설명 · canonical · OG/Twitter · hreflang · JSON-LD) · renderHeadHtml(서버) · applyHead/useSeo/<Seo>(브라우저) · sitemapXml · robotsTxt · @skeleton/seo/vite 의 seoFiles(빌드가 sitemap.xml · robots.txt)
├── marketing/                # Hero · FeatureGrid · FaqAccordion · Testimonial · CtaBand · SiteFooter · PricingTable(plans 데이터 · 월/연) · createConsentStore + ConsentBanner(추적 코드 없음) · LegalDocumentPage(판 바꾸기 · 템플릿 표시) · NotFoundPage/ServerErrorPage/MaintenancePage + src/patterns/ 의 Patterns/Landing · Pricing · LegalDocument · NotFound
├── time/                     # formatInstant/formatDate/formatDual · todayInZone · createServerClock · 국가→시간대
├── theme/                    # theme.ts · ThemeToggle · ThemedToaster · PRE_PAINT_SCRIPT + @skeleton/theme/vite(themePrePaint)
├── tokens/                   # tokens.json(정본) · build.mjs(생성기) · tokens.css(생성물) · 테스트 도구(findRawColors · findRawLayout …)
└── ui/                       # base.css · Button/Input/Field/Select/Textarea/Checkbox/Switch/Tabs/Table/Pagination/EmptyState/Card/Dialog/Spinner/AppShell · SwitchRow · SectionCard/SectionIndex · RowMenu(⋯ · 일반 드롭다운 `trigger` · `align`) · Skeleton · Avatar · Breadcrumbs · Alert · CopyButton · Tooltip · Stepper · Combobox(비동기) · DatePicker/DateRangePicker · InfiniteList · ConfirmDialog(문구 입력 확인) · MarkdownView(안전한 부분집합 · `{{키}}`) · ErrorReference · ErrorBoundary · showApiError · toastPromise — 부품마다 옆에 *.stories.tsx(CSF3 + play)
scripts/                      # new-project.sh(새 프로젝트 찍기) · new-project.d/stamp.mjs(일꾼) · test-new-project.sh(--quick · --full)
tests/                        # 워크스페이스 가로지르는 테스트: stories(모든 @skeleton/ui export 에 스토리 + play · 모든 Patterns 가 안내에 적힘 · 카탈로그 일치) · eslint.uiOnly(날 요소 · 인라인 날값 금지) · ssr.safety(모든 패키지가 window 없는 Node 에서 import · 모든 컴포넌트 · 훅이 서버에서 그려진다 — support/ssrFixtures.ts) · usage(날 색 · 날 간격/모서리/글자 크기 · --p-* · var 정의) · contrast(AA 짝) · tokens.wiring · theme.names · workspace(의존 규칙) · eslint.boundaries · skeleton.repo(이 레포의 앱 · 패키지 목록 — 찍을 때 지워진다)
docs/design-tokens.md         # 토큰 층 · 이름 · 추가법 + 생성된 표
docs/ui-catalog.md            # 부품 → 스토리 파일 → 언제 쓰는가(tests/stories.test.ts 가 스토리와의 일치를 지킨다)
```

**경계 책임:**

- `routes/` 는 페이지 단위 조합 + 데이터 fetching (TanStack Query 훅 호출)
- 재사용 UI 는 `@skeleton/ui`(props만 받음, API 호출 금지). 앱 전용 조각은 앱 안
- HTTP 호출은 앱의 `api/client.ts`(= `createApiClient` 인스턴스)만 수행. 페이지/컴포넌트에선 훅(`useQuery`)을 통해 쓴다
- 패키지는 `import.meta.env` · 모듈 전역 싱글턴 · 앱 코드 import 가 없다 — 환경변수 읽기와 인스턴스는 앱이 만든다
- 한 파일 200줄 넘어가면 분할 신호

## 새 프로젝트 찍기 (이 스켈레톤 레포에서 — 찍은 프로젝트에는 이 절이 없다)

`scripts/new-project.sh <target-dir> <name> [--packages a,b,c] [--ssr] [--without-storybook] [--with-workbench] [--with-sample] [--scope @acme]` — 레포를 복사해 `apps/starter`(`--ssr` 이면 `apps/starter-ssr`)를 `apps/<name>` 으로, `apps/storybook`(스토리집) · 남는 패키지의 스토리 · Patterns · 에이전트 안내 · `docs/ui-catalog.md` 는 기본으로 따라온다(**참조가 프로젝트와 함께 간다** — `--without-storybook` 이면 스토리 · 스토리집 · 그 도구 의존 · CI 잡을 모두 뗀다). **`apps/sample`(참조 앱 Notes)은 기본으로 떼고 `--with-sample` 일 때만 남긴다** — 그 앱이 쓰는 패키지가 따라오고, 샘플 전용 루트 스크립트(`dev:sample` · `e2e:sample`)와 `ci.yml` 의 `sample-e2e-job` 표식 사이 잡·CLAUDE.md 의 `sample` 표식 구역은 샘플을 떼면 함께 지워지고 가져가면 표식 줄만 걷힌다(이름 `sample` 은 예약). 패키지는 스타터가 쓰는 것 + 루트 도구(`theme` · `tokens`) + `--packages` 를 `@skeleton/*` 의존으로 닫은 집합만 남긴다(나머지 폴더 · `tests/skeleton.repo.test.ts` · new-project 도구는 지운다). 루트 `package.json` · eslint 앱 이름 막기 · README/CLAUDE/CHANGELOG 를 새 프로젝트용으로 바꾸고, `--scope` 면 `@skeleton` 을 모두 바꾼다. 고른 패키지는 폴더만 오고 앱 의존 한 줄은 쓰기 시작할 때 더한다(안 쓰는 의존은 루트 테스트가 막는다). 일꾼은 `scripts/new-project.d/stamp.mjs`.

- 빠른 검사 `bash scripts/test-new-project.sh --quick`(`pnpm test` 가 부른다) · 조합 전체 `--full`(기본 · `--packages realtime,notifications,storage`(+ `storybook:build` · `test:stories`) · `--packages board`(+ `storybook:build` · `test:stories`) · `--packages seo,marketing`(+ `storybook:build` · `test:stories`) · `--with-sample` · `--scope @acme --packages payment` · `--ssr --without-storybook` 를 찍어 각각 install · format · tokens:check · lint · typecheck · test · format:check · build — 네트워크, 수 분, 별도 워크플로 `.github/workflows/new-project.yml`).
- **패키지 · 앱을 더하거나 지우거나 이름을 바꾸면**: `tests/skeleton.repo.test.ts` 의 목록, 이 문서와 README 의 표, `stamp.mjs` 가 기대하는 문자열(`eslint.config.js` 의 `APP_NAMES` 목록 · `STORY_HINT` 줄 · `globalIgnores` 의 storybook-static 줄 · `ci.yml` 의 `stories-job` 표식 · CLAUDE.md 의 `storybook-guide` / `storybook` 표식 · `starter-ssr` 의 `src/appName.ts` · `Dockerfile` 의 `ARG APP` · `RootLayout.tsx` 의 `<strong>starter</strong>` · `index.html` 제목 · 루트 `test` 스크립트 꼴)을 함께 본다 — 어긋나면 `stamp.mjs` 가 조용히 넘기지 않고 멈춘다.

## 핵심 컨벤션

- **패키지 안쪽 금지**: 다른 패키지는 이름(`@skeleton/<이름>`)과 `exports` 하위 경로(`/tokens.css` · `/vite` · `/base.css`)로만 쓴다. `@skeleton/*/src/**` · 폴더를 벗어나는 상대 import · 앱 import 는 ESLint(`eslint.config.js`) + `tests/workspace.test.ts` 가 막는다
- **의존 선언 = 실제 import**: 앱 · 패키지가 `package.json` 에 적은 `@skeleton/*` 는 소스가 import 하는 것과 정확히 같아야 한다(`workspace:*`). 패키지를 새로 쓰면 앱 `package.json` 에 한 줄 더한다. `starter` 는 워크벤치에 의존하지 않는다. 패키지가 외부 라이브러리를 쓰면 `dependencies`(또는 `peerDependencies`)에 선언한다 — 이것도 테스트가 확인
- **HTTP 엔드포인트: 모듈이 열면 그 경로가 기본값, 안 열면 경로를 설정으로**: 백엔드 모듈이 컨트롤러를 여는 패키지(`notifications` → `/notifications`, `storage` → `/storage/*`, `board` → `/boards`)는 그 경로가 기본값이고 `basePath` · `storageEndpoints(basePath)` 로 바꾼다(모듈이 막힌 앱이 자기 컨트롤러를 두는 경우). 모듈이 서비스 계약만 주는 경우(`payment` · `captcha-turnstile`)는 기본 경로를 가정하지 않는다. 모듈 수준 계약만 겨냥한다 — 어느 Kotlin 파일의 어느 DTO 인지는 패키지 README 에
- **패키지를 만들거나 키울 때**: `package.json`(`exports` `.` = `{ types, default: ./src/index.ts }`, `test` · `typecheck` 스크립트) · `src/index.ts` barrel(공개 표면은 이것뿐) · 옆에 테스트 · `README.md`(API 표)를 갖춘다. 사용자에게 보이는 문구는 prop(기본 영어), 색은 의미 토큰만
- **SSR 안전**: 패키지는 import 할 때 브라우저 전역(`window` · `document` · `localStorage`)을 읽거나 쓰지 않는다 — 부수 효과는 명시적 호출(`@skeleton/theme` 의 `initTheme()` 을 앱이 시작할 때 부른다), 브라우저 API 는 effect · 핸들러 안에서만. 새 컴포넌트 · 훅을 export 하면 `tests/support/ssrFixtures.ts` 에 최소 props 한 줄을 더한다(안 하면 `tests/ssr.safety.test.ts` 가 실패, 일부러 브라우저 전용이면 `BROWSER_ONLY` 에 이유와 함께). 서버 렌더 앱 규칙(하이드레이션 일치 · 모듈 전역 금지 · 토큰은 브라우저에만)은 `apps/starter-ssr/README.md`
- **TypeScript strict**: `any` 금지. 필요하면 `unknown` + 타입 가드. 패키지 tsconfig 는 `types: []`(DOM 쓰는 UI 패키지만 `vite/client`)라 `import.meta.env` 를 쓰면 타입 에러
- **서버 상태는 TanStack Query로 일원화**: `useQuery`/`useMutation`. raw fetch 금지(실시간 스트림은 `@skeleton/realtime`)
- **공통 HTTP 는 `createApiClient`(axios 기반)**: baseUrl 은 `apiConfigFromEnv(import.meta.env)`(`VITE_API_BASE_URL` 또는 `/api/v1`). 에러는 `ApiRequestError` — 코드 분기는 `isErrorCode(error, ErrorCodes.AUTH_INVALID_CREDENTIALS)`, 코드는 백엔드 Kotlin enum 에 있는 것만 `packages/api-client/src/errorCodes.ts` 에 둔다
- **응답 DTO 표준화**: 단건은 `client.value<T>()`, 리스트는 `list<T>()`, 페이지는 `page<T>()`, 메타까지 필요하면 `response()`/`envelope()`
- **인증**: 토큰은 `@skeleton/auth` 의 `createTokenStore`(저장소 주입), 요청에는 `getAuthHeaders: createAuthHeadersProvider(store)`, 401 은 `onError: createUnauthorizedHandler({ store })`. 로그인한 사람만 보는 라우트는 `<RequireAuth />` 아래. dev-login/break-glass 헤더는 개발 · 점검용(`devLoginHeaders` · `breakGlassHeaders`)
- **디자인 토큰**: 색 · 그림자 · 서체 · 간격 · 모서리 · 글자 크기 값은 `packages/tokens/tokens.json` 에서만 정한다. 층은 둘 — 원시 `--p-*`(화면 CSS 에서 직접 사용 금지) → 의미 `--bg` `--text` …. 화면 CSS · 인라인 style 은 의미 토큰(`var(--…)`)만 쓴다(날 색 금지, `padding` · `margin` · `gap` · `border-radius` · `font-size` 의 px/rem/em 날값 금지 → `--space-*` · `--radius-*` · `--font-size-*`; 예외 앱은 `tests/support/layoutExempt.ts` 의 `apps/workbench` 뿐). 생성물 `packages/tokens/tokens.css` · `docs/design-tokens.md` 표 구역은 손으로 고치지 않고 `pnpm tokens`, CI 는 `pnpm tokens:check`. 라이트/다크는 `<html data-theme>`(`@skeleton/theme`), 글자/바탕 짝은 `tests/contrast.test.ts` 에 등록해 AA 를 지킨다. 부품(component) 층은 필요해질 때 추가(`docs/design-tokens.md`)
<!-- storybook:start -->
- **스토리가 부품의 정본이다**: 부품 스토리는 부품 옆(`packages/<이름>/src/<부품>/<부품>.stories.tsx`, CSF3 + `satisfies Meta` + `play`), 가짜(가짜 전송 · 받은편지함)는 그 패키지의 `src/stories/`. 스토리 파일과 `src/stories/` 는 테스트 쪽 파일로 세어 devDependencies 로 충분하다(`@skeleton/ui` 를 스토리에서만 쓰는 패키지는 devDependency 로 선언 + tsconfig `types: ["vite/client"]`). Patterns 는 `@skeleton/ui` · react · storybook 만 import 하고 도우미 파일을 두지 않는다. 합성 키 입력이 못 하는 브라우저 몫(`<dialog>` 의 Esc)은 `requestClose()` 로 같은 경로를 탄다. Storybook 도구는 모두 루트 devDependencies(패키지의 스토리도 거기서 푼다)
<!-- storybook:end -->
- **CSS Modules 우선**: 전역 CSS는 앱의 CSS 한 개(예: `apps/workbench/src/workbench.css`)와 `@skeleton/ui/base.css`(리셋 · 요소 타이포)에만. 필요해지면 Tailwind/shadcn 추가 검토
- **시각 3종** (`@skeleton/time`): ISO `...Z` 는 `formatInstant`, `YYYY-MM-DD` 는 `formatDate`(시간대 변환 금지), `ZonedMoment {local, zone, at}` 는 `formatDual`(이벤트 시간대 + 내 시간대). `new Date('YYYY-MM-DD')` 금지. 카운트다운은 `serverClock.now()`. 앱이 `getTimeZone: userTimeZone`, `onResponseDate` 로 연결하면 `X-Time-Zone` 이 자동으로 간다

## 백엔드와의 통신

Kotlin + Spring Boot 백엔드와 REST (`/api/v1/*`) 통신:

- **개발 기본값**: Vite dev(5173) → 백엔드(8080) proxy (각 앱 `vite.config.ts`, 목적지는 `API_PROXY_TARGET`). 백엔드와는 같은 작업 폴더에 `api` · `web` 으로 나란히 두고 백엔드 `scripts/dev.sh` 가 둘을 한 번에 띄운다(README 「백엔드와 나란히」)
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

PoC 기동 속도 + AI 친화성. 정적 번들 출력이라 호스팅 자유도 높음. SSR/SEO 가 필요한 앱은 프레임워크로 옮기지 않고 같은 스택 위의 `apps/starter-ssr`(plain Vite SSR — Node 서버 + 하이드레이션, 새 런타임 의존 없음)로 시작한다(`new-project.sh --ssr`). 스트리밍 · 서버 컴포넌트 · 파일 라우팅이 필요해지면 그때 프레임워크를 검토한다.

<!-- sample:start -->

## 새 기능의 정본 예시 — `apps/sample` (Notes)

새 기능(화면 + API 연결)을 짜기 전에 `apps/sample/README.md` 의 「화면 → Pattern 지도」를 읽고 **가장 가까운 화면을 따라 한다**. 이 앱은 Patterns · `@skeleton/ui` 만으로 조립한 완성품이라 「이 스켈레톤으로 이만큼 나온다」의 기준이기도 하다. 백엔드의 같은 조각은 kotlin-skeleton `apps/sample` + `docs/sample.md`(마이그레이션 → 엔티티 · 저장소 → 서비스 → 컨트롤러 · DTO → 알림 · 잡 → 테스트).

프론트 한 조각(`notes` 기준)을 더하는 순서:

1. **계약을 먼저** — 백엔드 DTO 와 같은 모양을 `src/<기능>/types.ts` 에. 코드는 백엔드 enum 에 있는 것만(앱 전용이면 그 폴더 안에, 패키지 `ErrorCodes` 가 아니라)
2. **HTTP 한 곳** — `src/<기능>/<기능>Api.ts`(`createXxxApi(client)`: 경로 · 메서드 · 본문). 테스트는 가짜 클라이언트로 경로 · 메서드 · 헤더(`Idempotency-Key`)를 잰다(`notesApi.test.ts`)
3. **쿼리 훅** — `src/<기능>/queries.ts`: 키는 한 뿌리, 쿼리 정의(키 + 함수)는 훅과 따로, 변경 훅은 성공하면 뿌리를 무효화(`notes/queries.ts`)
4. **화면은 Pattern 복사** — 목록 · 상세 · 폼 · 설정 · 대시보드 중 가장 가까운 Patterns 스토리를 `src/routes/` 로 복사해 문구 · 데이터만 연결. 글자는 `src/i18n/ko.ts`(기본 언어 · 키 타입의 출처) + `en.ts` 에 ICU 메시지로 두고 컴포넌트는 `const { t } = useT()` 로 읽는다(`@skeleton/i18n`). 백엔드 400 의 칸별 오류는 `formErrors.ts` 로 같은 칸에(`Form page` 의 `errors` 상태)
5. **부품이 모자라면 앱에 만들지 않는다** — `@skeleton/ui` 에 스토리 + `play` 와 함께 더하고 `docs/ui-catalog.md` · `tests/support/ssrFixtures.ts` 한 줄(Notes 를 위해 `PageHeader` · `Badge` · `Progress` · `FilePicker` · `Stat` 를 그렇게 더했다)
6. **여정 하나는 e2e 로** — `apps/sample/e2e/`(Playwright + vitest, 진짜 백엔드). 새 기능이 사용자 여정을 바꾸면 `journey.e2e.ts` 에 단계를 더한다. 실행 `pnpm e2e:sample`, 한 줄 로컬 실행은 백엔드 레포의 `scripts/dev-sample.sh`
<!-- sample:end -->

## 새 페이지 추가 시 (앱 안)

1. `apps/<앱>/src/routes/XxxPage.tsx` 생성 (named export 함수형 컴포넌트)
2. `src/routes/routes.tsx` 의 `children` 배열에 `{ path: '/xxx', element: <XxxPage /> }` 추가 (로그인 필요하면 `RequireAuth` 아래 `children`)
3. 필요하면 `layouts/RootLayout.tsx` 에 네비게이션 링크 추가
4. 데이터 fetch는 TanStack Query 훅(`hooks/useHello.ts` 모양) + `apiClient.value<T>('/path')`
<!-- storybook:start -->
5. 화면 본문은 처음부터 짜지 않고 가장 가까운 `Patterns/…` 스토리를 복사해 시작한다(위 표). 쓰는 부품의 스토리를 열어 사용법을 확인한다
<!-- storybook:end -->

## 검증 명령

루트에서: `pnpm lint` · `pnpm tokens:check` · `pnpm typecheck`(모든 앱 · 패키지 `tsc` + 루트 tests) · `pnpm test`(각 앱 · 패키지 + 루트 `tests/`) · `pnpm format:check` · `pnpm build`(네 앱). CI(`.github/workflows/ci.yml`)가 같은 순서로 돈다. 한 곳만: `pnpm --filter @skeleton/auth test`. dev 서버: `pnpm dev`(starter) · `pnpm dev:ssr` · `pnpm dev:workbench`.

**멈춤 주의**: `vite build` · `vitest` 가 0% CPU 로 영원히 멈추는 rolldown 교착이 vite 8.0.x 에 있었다(vite ^8.3.2 에서 재현 안 됨 — 내리지 말 것). 오래 걸릴 수 있는 명령은 `node scripts/with-watchdog.mjs --wall 300 --retries 2 -- <명령>` 으로 돌린다(자세히는 README 「알려진 함정」). macOS 에는 `timeout` 이 없다.

<!-- storybook:start -->

스토리집: `pnpm storybook`(http://localhost:6006) · `pnpm storybook:build`(정적 빌드) · `pnpm test:stories`(진짜 브라우저 headless — 모든 스토리의 `play` + a11y. Playwright chromium 이 필요하다: `pnpm exec playwright install chromium`). `pnpm test` 는 빠른 단위 테스트만 돌린다. CI 는 `stories` 잡이 `test:stories` 를 따로 돈다.

<!-- storybook:end -->

## 변경 이력

`CHANGELOG.md` 에 기록. 새 기능은 `[Unreleased]` 섹션에 먼저 적고 릴리스 시 버전 섹션으로 승격.
