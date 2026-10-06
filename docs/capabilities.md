<!-- 생성물 — capabilities.json 에서 `pnpm capabilities` 가 만든다. 손으로 고치지 않는다 -->

# 기능 카탈로그 — react-skeleton

React + TypeScript + Vite 프런트 스켈레톤(pnpm 워크스페이스) — 새 프로젝트가 필요한 패키지만 골라 찍어 가는 부품 · 화면 틀 · 패키지 모음. 백엔드는 형제 레포 kotlin-skeleton.

정본은 `capabilities.json`(스키마 `docs/capabilities.schema.json`)이고 이 문서 · `llms.txt` 는 거기서 만든다. 항목마다 한 줄 요약 · 켜는 법 · 짝 백엔드 · 진입점 · 따라 할 스토리 · 쓰지 않는 경우 · 한국어/영어 키워드가 있다.

## 읽는 법

- **무엇이 필요하다는 말을 받으면** 아래 결정표에서 그 말(키워드)을 찾아 id · 명령 조각을 고른다. 표에 없으면 「전체 목록」의 키워드 열을 훑는다. 만들기 전에 이미 있는지 먼저 본다.
- 명령 조각은 카탈로그의 `stampFlag` · `backend` 에서 계산한 것이다. 한 줄로 합치는 완성된 예는 `docs/new-project-recipe.md`.

## new-project.sh 인터페이스

- react: `scripts/new-project.sh <target-dir> <name> [--packages a,b,c] [--ssr] [--without-storybook] [--with-workbench] [--with-sample] [--scope @acme]`
- kotlin: `scripts/new-project.sh <target-dir> <root-package> <config-prefix> <ClassPrefix> [--modules a,b,c] [--db postgresql|mysql] [--with-workbench] [--with-sample] [--dry-run]`
- 조각을 합치는 법: `--packages` 는 하나로 합치고(쉼표), 다른 옵션(`--ssr` · `--with-sample` · `--scope` …)은 그대로 덧붙인다. 의존으로 닫히는 패키지는 적지 않아도 따라온다.

## 필요한 것 → 고를 것

| 필요한 것 | 고를 것(id) | react `new-project.sh` 조각 | kotlin `new-project.sh` 조각 | 그래도 손으로 써야 하는 것 |
|---|---|---|---|---|
| 로그인 (이메일 · 비밀번호) · 로그인한 사람만 보는 화면 | `auth` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 기본 포함. 로그인 · 가입 · 메일 확인 · 비밀번호 재설정 · 계정 설정은 createAuthRoutes 한 번(account-lifecycle). 어떤 방법이 열려 있는지는 백엔드(GET /auth/methods)가 알려 준다. 화면의 모양은 Patterns/Auth/* 스토리를 보고 labels · 설정으로 맞춘다. |
| 소셜 로그인 (구글 · 카카오 · 네이버) | `social-login` | (기본 포함 — 덧붙일 것 없음) | `--modules auth-social-google` — `auth-social-google` \| `auth-social-kakao` \| `auth-social-naver` 중 고른다 | 백엔드가 켠 제공자와 공개 clientId 는 GET /auth/methods 가 알려 줘 로그인 화면에 버튼이, /auth/callback 라우트가 생긴다(백엔드가 clientId 를 모르면 VITE_SOCIAL_<제공자>_CLIENT_ID). clientSecret 은 백엔드 skeleton.auth-social.providers.* 에만. |
| 게시판 · 글쓰기 · 댓글 · 대댓글 · 공감(반응) | `board` | `--packages board` | `--modules board,board-jdbc` | 게시판 코드 만들기(운영자 API), 목록 · 상세 · 글쓰기 라우트(apps/sample 의 BoardPage · BoardPostPage · BoardFormPage 를 복사), 반응 라벨 · 아이콘 맵, 반응 종류는 백엔드 yml(skeleton.board.reaction.types). |
| 알림 (종 · 목록 · 안 읽은 수) | `notifications` | `--packages notifications` | `--modules notification,notification-jdbc` | 헤더에 NotificationBell 배치와 알림 API 인스턴스(앱이 한 번 만든다). 알림을 만드는 쪽은 백엔드 코드(NotificationPublisher.publish). |
| 알림이 즉시 뜬다 (실시간) | `live-notifications` | `--packages notifications,realtime` | `--modules notification,notification-jdbc,notification-sse` — `notification-sse` \| `notification-websocket` 중 고른다 | 연결 훅 한 개(apps/sample/src/notifications/useLiveNotifications.ts 를 복사)와 백엔드의 SSE 또는 WebSocket 모듈 선택. |
| 다국어 (한국어 · 영어 전환) | `i18n` | `--packages i18n` | (모듈 없음) | 문구 사전(ko.ts · en.ts)과 부품 prop 에 t() 로 문구 넘기기, 헤더의 LanguageMenu 배치(apps/sample/src/i18n 을 복사). |
| 랜딩 페이지 + 검색 노출 | `landing-page` + `seo` | `--packages marketing,seo` | (모듈 없음) | 문구 · 이미지 · 요금제 데이터 · 푸터 링크, 라우트마다 handle.seo(제목 · 설명). 첫 HTML 노출이 중요하면 서버 렌더(다음 줄). |
| 서버 렌더링 (크롤러 · 링크 미리보기가 내용을 본다) | `app-starter-ssr` | `--ssr` | (모듈 없음) | 라우트마다 handle(제목 · 설명 · prefetch), 렌더 중 window · localStorage 금지, SITE_URL(공개 주소) — apps/starter-ssr/README.md. |
| 요금제 페이지 | `pricing-page` | `--packages marketing` | (모듈 없음) | 요금제 데이터(plans) · 통화 · 선택(onSelect) 이후의 결제 연결. |
| 이용약관 · 개인정보처리방침 | `legal-documents` | `--packages marketing` | (모듈 없음) | 법률 검토한 본문과 사실(facts) 채우기 — 템플릿은 법적 효력이 없다. |
| 쿠키 · 개인정보 동의 배너 | `cookie-consent` | `--packages marketing` | (모듈 없음) | 동의 범주 정의와 분석 스크립트를 동의에 따라 붙이는 코드(스켈레톤에는 추적 코드가 없다). |
| 404 · 500 · 점검 화면 | `error-pages` | `--packages marketing` | (모듈 없음) | 문구와 갈 곳 링크. SPA 는 HTTP 404 를 못 낸다. |
| 파일 업로드 (이미지 · 첨부) | `storage` | `--packages storage` | `--modules storage,storage-s3` | 업로더 인스턴스(검증 규칙을 백엔드와 같게)와 업로드 화면 조각(FilePicker + Progress + useUpload — apps/sample 의 AttachmentPanel). |
| 결제 (토스 · 스트라이프) | `payment` | `--packages payment` | `--modules payment,payment-toss` — `payment-toss` \| `payment-stripe` 중 고른다 | 결제 위젯(토스 SDK) · 주문/금액 검증 컨트롤러(백엔드 앱) · 성공/실패 리다이렉트 라우트(confirmRequestFromTossRedirect). 백엔드 모듈이 HTTP 를 열지 않는다. |
| 봇 방지 (캡차) | `captcha-turnstile` | `--packages captcha-turnstile` | (모듈 없음) | 가입 · 로그인 폼에 <Turnstile> 을 놓고 attachTurnstileToken 으로 요청에 붙인다. 검증은 백엔드. |
| 관리자 · 대시보드 · 목록 · 상세 · 폼 · 설정 화면 | `screen-patterns` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 기본 포함. 화면마다 가장 가까운 Pattern 을 복사하고 데이터 훅(TanStack Query)을 잇는다(apps/sample/src/notes 를 보고). |
| 다크 모드 · 테마 | `theme` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 기본 포함. 색 값은 tokens.json 에서. |
| 브랜드 색 · 간격 · 글자 크기 바꾸기 | `tokens` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 기본 포함. packages/tokens/tokens.json 만 고치고 pnpm tokens. |
| 시간대 · 날짜 표시 · 카운트다운 | `time` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 기본 포함. 달력 날짜(YYYY-MM-DD)는 formatDate, 순간은 formatInstant. |
| 백엔드 호출 · 에러 코드 · 멱등 키 | `api-client` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 기본 포함. 앱의 api/client.ts 한 곳에서 인스턴스를 만든다. |
| 서버가 밀어 주는 실시간 연결만 (SSE · WebSocket 클라이언트) | `realtime` | `--packages realtime` | `--modules notification-sse` — `notification-sse` \| `notification-websocket` 중 고른다 | 연결 훅을 앱이 만든다(apps/sample/src/notifications/useLiveNotifications.ts 참고). 보내는 쪽은 백엔드 notification-sse 또는 notification-websocket. |
| 공개 페이지 부품 (Hero · 기능 · FAQ · 후기 · 푸터) | `marketing` | `--packages marketing` | (모듈 없음) | 문구 · 이미지 · 링크는 프로젝트가 채운다 — 한 장으로 묶인 Pattern 은 랜딩 · 요금제 · 약관 · 404 행. |
| 화면 부품 (버튼 · 입력 · 표 · 모달 · 탭 · 날짜 선택) | `ui` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 기본 포함. 쓰기 전에 docs/ui-catalog.md 에서 그 부품의 스토리를 읽고 같은 사용법으로 쓴다. 날 요소를 쓰지 않는다. |
| 참조 앱을 같이 가져가서 보고 따라 하기 | `app-sample` | `--with-sample` | `--modules alert-jdbc,auth-magic-link,board,board-jdbc,crypto,json,notification,notification-jdbc,notification-sse,storage,storage-s3` | 샘플은 참조다 — 쓰지 않을 화면은 지운다. 백엔드는 kotlin-skeleton apps/sample 과 짝. |
| 백엔드 모듈을 눌러 보는 확인 벤치 | `app-workbench` | `--with-workbench` | `--modules alert-jdbc,async,async-notification,auth-magic-link,auth-social-google,auth-social-kakao,auth-social-naver,board,board-jdbc,config-aws-ssm,crypto,event-kafka,json,notification,notification-jdbc,notification-slack,notification-sse,notification-websocket,payment,payment-stripe,payment-toss,persistence-jpa,redis-cache,redis-core,redis-lock,redis-rate-limit,scheduler,storage,storage-s3` | 복사 대상이 아니다 — 백엔드 개발자가 모듈을 눈으로 확인하는 용도. |
| 회원가입 · 이메일 인증 · 비밀번호 재설정 · 계정 설정(비밀번호 · 이메일 · 세션 · 삭제) | `auth` + `account-lifecycle` + `session-refresh` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 백엔드는 account · auth-session(+ -jdbc) 모듈과 메일(notification-mail) · 링크 주소 설정. 프런트는 createAuthRoutes 한 번(apps/starter 의 auth/routes.tsx 를 따른다), 켜는 로그인 방법은 백엔드가 알려 준다(고정하려면 new-project.sh --auth-methods 또는 VITE_AUTH_METHODS), 문구는 labels(koAuthLabels). |
| 이메일 링크(매직링크) 로그인 | `magic-link-login` | (기본 포함 — 덧붙일 것 없음) | `--modules auth-magic-link` | 백엔드 auth-magic-link + 메일. 로그인 화면의 링크 버튼 · /magic-link 도착 화면은 백엔드가 그 방법을 열었을 때(GET /auth/methods)만 보인다. |
| 운영자 계정 관리 표 (검색 · 정지 · 복구 · 역할) | `account-admin` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 백엔드 skeleton.account.admin.enabled=true. 프런트는 apps/sample 의 AdminAccountsPage 와 RequireRole 라우트를 복사한다. |
| 약관 · 개인정보 동의 (가입 체크박스 · 새 판 재동의 · 선택 동의 철회) — 문서와 동의 기록은 서버가 쥔다 | `legal` | (기본 포함 — 덧붙일 것 없음) | (모듈 없음) | 백엔드 스타터는 legal 을 켠다(문서는 TEMPLATE — stage · prod 는 자기 문서가 있어야 기동). 프런트는 createLegalApi + createReconsentController(api-client 의 recoverForbidden 에 꽂는다) + <ReconsentGate> 를 앱 맨 위에, 가입 라우트의 signUp.renderConsents 에 <SignUpConsents>, 설정에 <ConsentSettings>. 서버 없이 정적 약관만이면 legal-documents(marketing). |

## 전체 목록

### 패키지 (`packages/*`)

| id | 무엇을 주는가 | 켜는 법 | 백엔드 | 상태 | 키워드 (ko / en) |
|---|---|---|---|---|---|
| `api-client` | 백엔드 REST 호출 한 곳 — 응답 envelope 벗기기 · 표준 에러(ApiRequestError · 에러 코드) · traceparent · 멱등 키 · 서버 시각 연결점을 갖춘 클라이언트. | 항상 | platform | stable | API 호출, 백엔드 연결, 에러 처리, 에러 코드, 멱등 키, traceId / api client, rest, http client, error codes, idempotency key, trace id |
| `auth` | 로그인 · 계정 수명주기 — 토큰 갱신(401 → 갱신 한 번 → 재시도, 회전 안전 · 탭 락) · 가입 · 메일 인증 · 비밀번호 재설정 · 링크 로그인 · 소셜 · 계정 설정(비밀번호 · 이메일 · 로그인 수단 · 세션 · 삭제) 화면과 라우트 한 벌, 방법은 설정으로 켜고 끈다. | 항상 | auth | stable | 로그인, 로그아웃, 인증, 토큰, JWT, 보호 라우트 / login, logout, auth, authentication, jwt, token |
| `realtime` | 서버가 밀어 주는 실시간 연결 — SSE(탭 숨김 일시정지 · 유휴 감시 · 재연결)와 STOMP WebSocket 알림 클라이언트. | --packages realtime | (경로만) | stable | 실시간, 실시간 알림, SSE, 웹소켓, 푸시, 연결 유지 / realtime, sse, server-sent events, websocket, stomp, push |
| `i18n` | 화면 문구 다국어 — ICU 메시지 · 브라우저 언어 감지/저장 · 지연 로딩 사전 · useT() · 사전 짝 맞춤 테스트 도구. | --packages i18n | — | stable | 다국어, 번역, 언어 전환, 한국어 영어, 국제화, 로케일 / i18n, internationalization, localization, translation, locale, multi-language |
| `notifications` | 알림 받은편지함 — 목록 · 안 읽은 수 · 읽음/모두 읽음 · 실시간 이벤트로 캐시 갱신, NotificationBell/List 부품과 TanStack Query 훅. | --packages notifications | notification, notification-jdbc | stable | 알림, 알림 목록, 알림 종, 안 읽은 알림, 읽음 처리, 받은편지함 / notifications, inbox, notification bell, unread count, mark as read |
| `board` | 게시판 — 글 · 중첩 댓글(대댓글) · 서버 설정으로 늘어나는 반응(좋아요 · 공감 …) · 운영자 숨김/고정, 목록 · 상세 · 편집기 · 댓글 · 반응 부품과 훅(반응은 낙관적 갱신). | --packages board | board, board-jdbc | stable | 게시판, 커뮤니티, 글쓰기, 댓글, 대댓글, 공감 / board, forum, community, post, comment, reply |
| `storage` | 파일 업로드 — 검증 → presign → 브라우저에서 스토리지로 직접 PUT(진행률 · 취소 · 멀티파트)과 useUpload 훅. | --packages storage | storage, storage-s3 | stable | 파일 업로드, 이미지 업로드, 첨부파일, 프리사인, 대용량 업로드, 멀티파트 / file upload, image upload, attachment, presigned url, multipart, s3 |
| `payment` | 결제 계약 — 토스 성공 리다이렉트를 승인 요청으로 바꾸고 승인/취소/환불을 부르는 얇은 클라이언트(경로는 앱이 정한다). | --packages payment | payment | experimental | 결제, 토스, 스트라이프, 환불, 카드 결제, 결제 승인 / payment, toss, stripe, checkout, refund, billing |
| `captcha-turnstile` | 봇 방지 — Cloudflare Turnstile 스크립트 로더 · <Turnstile> · 토큰 훅 · 요청에 토큰 붙이기. | --packages captcha-turnstile | captcha-turnstile | stable | 캡차, 봇 방지, 스팸 방지, 로봇 확인, 가입 폼 보호 / captcha, turnstile, bot protection, cloudflare, spam protection |
| `seo` | 검색 · 공유 미리보기 — 제목 · 설명 · canonical · OG/Twitter · hreflang · JSON-LD 를 SPA(effect)와 SSR(문자열)에서 같은 규칙으로, 빌드 때 sitemap.xml · robots.txt 까지. | --packages seo | — | stable | 검색 노출, SEO, 메타 태그, OG 이미지, 링크 미리보기, 사이트맵 / seo, meta tags, open graph, twitter card, canonical, sitemap |
| `marketing` | 공개 페이지 조립 부품 — Hero · 기능 · FAQ · 후기 · CTA · 푸터 · 요금제(월/연) · 쿠키 동의 · 약관 문서 페이지 · 404/500/점검 화면. | --packages marketing | — | stable | 랜딩, 랜딩 페이지, 홈페이지, 요금제, 가격표, FAQ / landing page, marketing site, pricing table, faq, terms of service, privacy policy |
| `legal` | 법적 문서 · 동의 — 서버의 약관 읽기(마크다운 · 판 · 효력일) · 가입 동의 체크리스트(필수/선택 · 전체 동의 · 문서 다이얼로그) · 첫 로그인과 새 판 재동의(403 LEGAL.RECONSENT_REQUIRED 를 api-client 계층에서 받아 동의 뒤 막힌 호출을 다시 보낸다) · 동의 설정(이력 · 선택 동의 철회). | 항상 | legal, legal-jdbc | stable | 약관 동의, 가입 동의 체크박스, 재동의, 개인정보 동의, 마케팅 수신 동의, 동의 철회 / terms consent, sign-up consent checkbox, re-consent, privacy consent, marketing opt-in, withdraw consent |
| `time` | 글로벌 시간 — 순간 · 달력 날짜 · 현지+내 시간대 3종 포맷, 서버 시각 보정(카운트다운), 국가→시간대, 오늘의 날짜. | 항상 | time | stable | 시간, 날짜 표시, 시간대, 타임존, 서버 시각, 카운트다운 / time, date format, timezone, server clock, countdown, relative time |
| `theme` | 라이트/다크/시스템 테마 — 토글 · 토스트 테마 · 첫 칠 전 스크립트(깜빡임 방지) · Vite 플러그인. | 항상 | — | stable | 다크 모드, 테마, 라이트 모드, 다크 테마 / dark mode, theme, light mode, color scheme |
| `tokens` | 디자인 토큰 — 색 · 간격 · 모서리 · 글자 크기의 단일 정본(tokens.json)과 생성기 → tokens.css(라이트/다크), 날값 검출 테스트 도구. | 항상 | — | stable | 디자인 토큰, 색상, 브랜드 색, 간격, 디자인 시스템, 색 바꾸기 / design tokens, colors, brand color, spacing, design system, css variables |
| `ui` | 화면 부품 — Button · Input/Field · Select · Table · Pagination · Dialog · Tabs · AppShell · Combobox · DatePicker · MarkdownView 등, 모두 스토리 + play + 접근성 테스트. | 항상 | — | stable | 버튼, 입력창, 폼, 표, 테이블, 모달 / button, input, form, table, modal, dialog |

### 앱 (`apps/*`)

| id | 무엇을 주는가 | 켜는 법 | 백엔드 | 상태 | 키워드 (ko / en) |
|---|---|---|---|---|---|
| `app-starter` | SPA 스타터 — 라우터 · AppShell · 테마 토글 · API 클라이언트 · 로그인 · 보호 라우트가 이어진 출발점(새 프로젝트의 앱이 된다). | 항상 | account, account-jdbc, alert, auth, auth-session, auth-session-jdbc, auth-social, captcha-turnstile, db-postgresql, idempotency, job-queue-jdbc, legal, legal-jdbc, migration, migration-flyway, notification-mail, persistence-jdbc, platform, time | stable | 스타터, SPA, 시작 템플릿, 새 앱, 프런트 시작 / starter, spa, boilerplate, vite react, frontend start |
| `app-starter-ssr` | 서버 렌더 스타터 — Node 서버가 첫 응답을 그리고 브라우저가 이어받는다(plain Vite SSR · Dockerfile · 라우트별 제목 · 설명 · 데이터 미리 가져오기). | --ssr | account, account-jdbc, alert, auth, auth-session, auth-session-jdbc, auth-social, captcha-turnstile, db-postgresql, idempotency, job-queue-jdbc, legal, legal-jdbc, migration, migration-flyway, notification-mail, persistence-jdbc, platform, time | stable | 서버 렌더링, SSR, 검색 노출, 첫 화면 빠르게, 콘텐츠 사이트, 링크 미리보기 / ssr, server-side rendering, seo, node server, hydration, content site |
| `app-sample` | 참조 앱 Notes — Patterns 로 조립한 작지만 실제 같은 제품(랜딩 · 로그인 · 대시보드 · 목록 · 상세 · 폼 · 첨부 · 알림 · 게시판 · 다국어 · 설정 · 404), 새 기능은 이 앱의 한 조각을 따라 한다. | --with-sample | account, account-jdbc, alert, alert-jdbc, auth, auth-magic-link, auth-session, auth-session-jdbc, auth-social, board, board-jdbc, captcha-turnstile, crypto, db-postgresql, idempotency, job-queue-jdbc, json, legal, legal-jdbc, migration, migration-flyway, notification, notification-jdbc, notification-mail, notification-sse, persistence-jdbc, platform, storage, storage-s3, time | template-only | 참조 앱, 예제 앱, 샘플, 제품 모양, 노트 앱, 화면 조립 예 / reference app, sample app, example, demo product, notes app |
| `app-storybook` | 스토리집 — 모든 부품 · 복사해 시작하는 화면 틀(Patterns) · 토큰을 백엔드 없이 보고, 진짜 브라우저로 동작 · 접근성을 테스트한다. | 기본 | — | stable | 스토리북, 스토리집, 화면 틀, 컴포넌트 카탈로그, 접근성 테스트, 컴포넌트 문서 / storybook, component catalog, patterns, a11y test, component docs |
| `app-workbench` | 백엔드 확인용 시각적 테스트 벤치 — 백엔드 모듈을 눌러 보는 화면들과 /packages 예제 화면. | --with-workbench | account, account-jdbc, alert, alert-jdbc, async, async-notification, auth, auth-magic-link, auth-session, auth-session-jdbc, auth-social, auth-social-google, auth-social-kakao, auth-social-naver, board, board-jdbc, captcha-turnstile, config-aws-ssm, crypto, db-postgresql, event-kafka, idempotency, job-queue-jdbc, json, legal, legal-jdbc, migration, migration-flyway, notification, notification-jdbc, notification-mail, notification-slack, notification-sse, notification-websocket, payment, payment-stripe, payment-toss, persistence-jdbc, persistence-jpa, platform, redis-cache, redis-core, redis-lock, redis-rate-limit, scheduler, storage, storage-s3, time | experimental | 워크벤치, 백엔드 확인, 시각적 테스트, 모듈 데모 / workbench, backend smoke test, visual test bench, module demo |

### 패턴 (패키지 안의 한 기능 · 화면 틀)

| id | 무엇을 주는가 | 켜는 법 | 백엔드 | 상태 | 키워드 (ko / en) |
|---|---|---|---|---|---|
| `social-login` | 소셜 로그인의 프런트 절반 — 제공자 인가 주소 · state 검증(탭에 묶임 · 한 번만) · 콜백의 code 를 백엔드로 보내 로그인 처리, 로그인한 계정에 제공자를 더하는 연결 흐름(createSocialLinkFlow). 버튼 · 콜백 화면은 SignInScreen · createAuthRoutes 가 그린다. | 항상 | auth-social | stable | 소셜 로그인, 구글 로그인, 카카오 로그인, 네이버 로그인, 간편 로그인, OAuth / social login, google login, kakao login, naver login, oauth, sso |
| `account-lifecycle` | 계정 수명주기 화면 한 벌 — 가입(서버 정책 힌트 · 캡차 · 동의 슬롯 · 메일로 받은 6자리 인증번호를 같은 화면에서 입력하면 바로 로그인) · 비밀번호 재설정 · 링크 로그인 도착 · 로그인(방법은 백엔드가 알려 준다) · 계정 설정(이메일 변경 · 첫 비밀번호 · 소셜 연결/해제 · 삭제의 다시 인증은 비밀번호 · 메일 인증번호(그 자리에서 입력) · 제공자 동의 중 계정에 맞는 하나, 이메일 변경 대기는 서버가 말해 준다) · 오래된 메일 링크 안내 · 정지/차단 안내. createAuthRoutes 가 라우트까지 한 번에. | 항상 | account, account-jdbc, auth-session, auth-session-jdbc | stable | 회원가입, 가입 화면, 이메일 인증, 메일 확인, 비밀번호 재설정, 비밀번호 찾기 / sign up, registration screen, verify email, check your email, reset password, forgot password |
| `session-refresh` | 액세스 토큰 자동 갱신 — 401 이면 갱신을 한 번으로 합쳐(single-flight) 요청을 한 번만 다시 보낸다. 회전하는 리프레시 토큰을 안전하게 저장하고 탭 사이를 락 · storage 이벤트로 맞추며, 재사용 · 만료 때는 깨끗이 로그아웃. body · cookie 모드. | 항상 | auth-session, auth-session-jdbc | stable | 토큰 갱신, 리프레시 토큰, 자동 로그인 유지, 세션 만료, 탭 동기화 / token refresh, refresh token, silent refresh, session expiry, cross-tab sync |
| `magic-link-login` | 이메일 링크 로그인 — 로그인 화면의 「링크 받기」 · 메일 확인 안내 · 링크를 열면 로그인되는 도착 화면. 비밀번호 없이 쓰거나 비밀번호와 나란히 켠다. | 항상 | auth-magic-link | stable | 링크 로그인, 매직링크, 비밀번호 없는 로그인, 이메일 로그인 / magic link, passwordless, email sign in |
| `account-admin` | 운영자 계정 표(선택 내보내기 @skeleton/auth/admin) — 검색 · 상태 필터 · 정지 · 해제 · 삭제 유예 복구 · 역할 부여/회수. | 항상 | account | stable | 운영자 도구, 계정 관리, 계정 정지, 관리자 화면 / admin tools, account management, suspend account, admin panel |
| `live-notifications` | 알림이 새로고침 없이 즉시 뜬다 — 실시간 연결(SSE 또는 WebSocket)로 받은 이벤트를 알림 캐시에 넣어 종 · 목록 · 안 읽은 수가 바로 바뀐다. | --packages notifications | (경로만) | stable | 실시간 알림, 알림 즉시 표시, 푸시 알림, 알림 종 실시간 / live notifications, realtime notifications, push notifications, sse notifications |
| `landing-page` | 공개 첫 화면 — Hero · 기능 · 한마디 · 요금제 · FAQ · 마지막 권유 · 푸터를 Patterns/Landing 한 장으로 조립해 시작한다. | --packages marketing | — | stable | 랜딩, 랜딩 페이지, 홍보 페이지, 첫 화면, 홈페이지 / landing page, homepage, marketing page, hero section |
| `pricing-page` | 요금제 페이지 — 월/연 토글 · 절약 % · 강조 요금제 · 문의형 · 결제 질문 FAQ 를 데이터(plans)로 그리고 선택은 onSelect 로 받는다. | --packages marketing | — | stable | 요금제, 가격표, 플랜, 월 연 결제 토글, 구독 요금 / pricing page, pricing table, plans, subscription pricing |
| `legal-documents` | 약관 · 개인정보처리방침 페이지 — 판(版) 바꾸기 · 효력일 · 옛 판 안내 · 「템플릿」 표시 · 사실({{키}}) 채우기, 문서는 마크다운. | --packages marketing | — | template-only | 약관, 이용약관, 개인정보처리방침, 법적 문서, 방침 / terms of service, privacy policy, legal document, tos |
| `cookie-consent` | 쿠키 · 추적 동의 — 동의 저장소(버전이 바뀌면 다시 묻기 · 필수 범주는 못 끈다)와 배너(모두 거부 = 모두 허용과 같은 무게). | --packages marketing | — | stable | 쿠키 동의, 동의 배너, 개인정보 동의, GDPR / cookie consent, consent banner, gdpr, privacy consent |
| `error-pages` | 없는 주소(404) · 서버 오류(500, 참조 번호) · 점검 화면 — 이유를 말하고 갈 곳을 준다. | --packages marketing | — | stable | 404, 오류 페이지, 점검 페이지, 500 에러, 없는 페이지 / 404 page, error page, maintenance page, 500 error, not found |
| `screen-patterns` | 제품 화면 틀 — 대시보드 · 목록 · 폼 · 상세 · 로그인 · 권한 없음 · 설정을 Patterns/… 스토리에서 복사해 문구 · 데이터 연결만 바꿔 시작한다. | 항상 | — | stable | 대시보드, 목록 화면, 폼 화면, 상세 화면, 설정 화면, 관리자 화면 / dashboard, list page, form page, detail page, settings page, admin screen |

### 스크립트 (`scripts/*`)

| id | 무엇을 주는가 | 켜는 법 | 백엔드 | 상태 | 키워드 (ko / en) |
|---|---|---|---|---|---|
| `script-new-project` | 새 프로젝트 한 줄 찍기 — 이 레포를 복사해 고른 패키지 · 앱만 남기고 이름 · 스코프를 바꾸고 문서와 이 카탈로그를 걸러 다시 쓴다. | — | — | stable | 새 프로젝트, 프로젝트 만들기, 찍어내기, 스캐폴딩, 프로젝트 시작 / new project, scaffold, stamp, template, project generator |
| `script-test-new-project` | new-project.sh 의 테스트 — 빠른 검사와 --full(여러 조합과 레시피의 예제 명령을 정말 찍어 install · lint · typecheck · test · build). | — | — | stable | 찍기 테스트, 조합 검증, 스캐폴딩 테스트 / stamp test, combination test, scaffold test |
| `script-with-watchdog` | 0% CPU 로 멈추는 빌드 · 테스트(rolldown 교착)를 시간으로 끊고 다시 돌리는 감시자 — 명령 앞에 붙인다. | 항상 | — | stable | 빌드 멈춤, 워치독, 교착, 멈춘 테스트 재시도 / watchdog, hang, stall, retry build, timeout |
| `script-build-capabilities` | capabilities.json 에서 docs/capabilities.md · llms.txt 를 생성하고(--check 로 어긋남 검사) 같은 가드를 돌린다. | 항상 | — | stable | 기능 카탈로그, 카탈로그 생성, 카탈로그 점검, 기능 목록 / capabilities catalog, generate docs, catalog check, feature list |

## 항목 상세

### `api-client` — 백엔드 REST 호출 한 곳 — 응답 envelope 벗기기 · 표준 에러(ApiRequestError · 에러 코드) · traceparent · 멱등 키 · 서버 시각 연결점을 갖춘 클라이언트.

- 종류 · 상태: package · stable
- 위치: `@skeleton/api-client` (`packages/api-client`)
- 켜는 법: 모든 프로젝트에 들어간다
- 백엔드: 모듈 `platform` · 경로 `/api/v1`
- 주요 진입점: `createApiClient` · `apiConfigFromEnv` · `ApiRequestError` · `isErrorCode` · `ErrorCodes` · `newIdempotencyKey` · `createTraceContext`
- 문서: `packages/api-client/README.md`
- 쓰지 않는 경우: 실시간 스트림(SSE · WebSocket) → realtime / 페이지 · 컴포넌트에서 fetch/axios 를 직접 부르지 않는다 — 앱의 api/client.ts 인스턴스를 훅(useQuery)으로 쓴다
- 키워드: API 호출, 백엔드 연결, 에러 처리, 에러 코드, 멱등 키, traceId, 응답 형식 / api client, rest, http client, error codes, idempotency key, trace id, axios

### `auth` — 로그인 · 계정 수명주기 — 토큰 갱신(401 → 갱신 한 번 → 재시도, 회전 안전 · 탭 락) · 가입 · 메일 인증 · 비밀번호 재설정 · 링크 로그인 · 소셜 · 계정 설정(비밀번호 · 이메일 · 로그인 수단 · 세션 · 삭제) 화면과 라우트 한 벌, 방법은 설정으로 켜고 끈다.

- 종류 · 상태: package · stable
- 위치: `@skeleton/auth` (`packages/auth`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `api-client` · `ui`
- 백엔드: 모듈 `auth` · 있으면 더 켜지는 `account` · `account-jdbc` · `auth-session` · `auth-session-jdbc` · `auth-magic-link` · 경로 `/api/v1/auth` · `/api/v1/account`
- 주요 진입점: `createTokenStore` · `createRefreshStore` · `createAuthApi` · `createAuthSession` · `createSessionRefresher` · `createAccountApi` · `createAuthRoutes` · `AuthProvider` · `useAuth` · `RequireAuth` · `RequireRole` · `SignInScreen` · `SignUpScreen` · `AccountSettings` · `createAuthHeadersProvider` · `createUnauthorizedHandler`
- 보고 따라 할 스토리: `packages/auth/src/RequireAuth.stories.tsx`
- 복사해 시작할 Patterns: `apps/storybook/src/patterns/LoginPage.stories.tsx` · `apps/storybook/src/patterns/ForbiddenPage.stories.tsx` · `packages/auth/src/patterns/SignIn.stories.tsx` · `packages/auth/src/patterns/SignUp.stories.tsx` · `packages/auth/src/patterns/MailLinkLandings.stories.tsx` · `packages/auth/src/patterns/AccountSettings.stories.tsx`
- 문서: `packages/auth/README.md`
- 쓰지 않는 경우: 권한(roles) 정책 자체는 백엔드 — 이 패키지는 토큰 · 라우트 가드(RequireAuth · RequireRole)만 / 약관 동의 저장은 없다 — 가입 화면의 동의 슬롯은 체크한 판을 콜백으로 보고할 뿐(백엔드 동의 모듈이 아직 없다) / 로그인 화면의 모양(색 · 로고 · 문구 톤)은 앱의 몫 — 문구는 labels prop(기본 영어, koAuthLabels 한국어)
- 키워드: 로그인, 로그아웃, 인증, 토큰, JWT, 보호 라우트, 로그인 상태, 세션, 회원가입, 가입, 이메일 인증, 비밀번호 재설정, 비밀번호 찾기, 계정 설정, 계정 삭제, 토큰 갱신, 리프레시 토큰, 세션 목록 / login, logout, auth, authentication, jwt, token, session, protected route, sign in, sign up, registration, email verification, password reset, forgot password, account settings, delete account, refresh token, token refresh, active sessions

### `realtime` — 서버가 밀어 주는 실시간 연결 — SSE(탭 숨김 일시정지 · 유휴 감시 · 재연결)와 STOMP WebSocket 알림 클라이언트.

- 종류 · 상태: package · stable
- 위치: `@skeleton/realtime` (`packages/realtime`)
- 켜는 법: `--packages realtime` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` · `--with-workbench` 로도 따라온다
- 필요한 것: `api-client`
- 백엔드: `notification-sse` | `notification-websocket` 중 하나 이상 · 경로 `/api/v1/notifications/sse`
- 주요 진입점: `createSseClient` · `useSseClient` · `createStompNotificationClient` · `useNotificationSocket` · `websocketUrlFromApiBase`
- 문서: `packages/realtime/README.md`
- 쓰지 않는 경우: 알림 목록 · 안 읽은 수 화면 → notifications (이 패키지는 연결만 맡는다) / 일반 REST 호출 → api-client
- 키워드: 실시간, 실시간 알림, SSE, 웹소켓, 푸시, 연결 유지 / realtime, sse, server-sent events, websocket, stomp, push, live updates

### `i18n` — 화면 문구 다국어 — ICU 메시지 · 브라우저 언어 감지/저장 · 지연 로딩 사전 · useT() · 사전 짝 맞춤 테스트 도구.

- 종류 · 상태: package · stable
- 위치: `@skeleton/i18n` (`packages/i18n`)
- 켜는 법: `--packages i18n` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` 로도 따라온다
- 백엔드: 없음(프런트만)
- 주요 진입점: `createI18n` · `I18nProvider` · `useT` · `detectLocale` · `@skeleton/i18n/testing#catalogProblems`
- 보고 따라 할 스토리: `packages/i18n/src/I18nProvider.stories.tsx` · `packages/ui/src/LanguageMenu/LanguageMenu.stories.tsx`
- 문서: `packages/i18n/README.md`
- 쓰지 않는 경우: 날짜 · 시간 표시 → time (i18n 은 문구만) / 검색용 hreflang · 언어별 머리 → seo / 번역 자체는 만들어 주지 않는다 — 사전(ko.ts · en.ts)을 프로젝트가 쓴다
- 키워드: 다국어, 번역, 언어 전환, 한국어 영어, 국제화, 로케일, 언어 메뉴 / i18n, internationalization, localization, translation, locale, multi-language, icu messages

### `notifications` — 알림 받은편지함 — 목록 · 안 읽은 수 · 읽음/모두 읽음 · 실시간 이벤트로 캐시 갱신, NotificationBell/List 부품과 TanStack Query 훅.

- 종류 · 상태: package · stable
- 위치: `@skeleton/notifications` (`packages/notifications`)
- 켜는 법: `--packages notifications` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` · `--with-workbench` 로도 따라온다
- 필요한 것: `api-client` · `time` · `ui`
- 백엔드: 모듈 `notification` · `notification-jdbc` · 있으면 더 켜지는 `notification-sse` · `notification-websocket` · 경로 `/api/v1/notifications`
- 주요 진입점: `createNotificationsApi` · `useNotifications` · `useUnreadCount` · `useMarkRead` · `useMarkAllRead` · `useNotificationIngest` · `NotificationBell` · `NotificationList`
- 보고 따라 할 스토리: `packages/notifications/src/NotificationBell.stories.tsx` · `packages/notifications/src/NotificationList.stories.tsx`
- 문서: `packages/notifications/README.md`
- 쓰지 않는 경우: 알림을 보내는 쪽(발행)은 백엔드 코드(NotificationPublisher) — 이 패키지는 받는 화면만 / 이메일 · Slack 알림 → 백엔드 notification-mail · notification-slack (프런트 짝 없음) / 실시간으로 즉시 뜨게 하려면 realtime 을 더한다(live-notifications)
- 키워드: 알림, 알림 목록, 알림 종, 안 읽은 알림, 읽음 처리, 받은편지함 / notifications, inbox, notification bell, unread count, mark as read

### `board` — 게시판 — 글 · 중첩 댓글(대댓글) · 서버 설정으로 늘어나는 반응(좋아요 · 공감 …) · 운영자 숨김/고정, 목록 · 상세 · 편집기 · 댓글 · 반응 부품과 훅(반응은 낙관적 갱신).

- 종류 · 상태: package · stable
- 위치: `@skeleton/board` (`packages/board`)
- 켜는 법: `--packages board` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` 로도 따라온다
- 필요한 것: `api-client` · `time` · `ui`
- 백엔드: 모듈 `board` · `board-jdbc` · 있으면 더 켜지는 `notification` · `idempotency` · 경로 `/api/v1/boards`
- 주요 진입점: `createBoardApi` · `useBoardConfig` · `usePosts` · `usePost` · `useCreatePost` · `useReaction` · `PostList` · `PostDetail` · `PostEditor` · `CommentThread` · `BoardComments` · `ReactionBar` · `PostReactionBar` · `nestThread`
- 보고 따라 할 스토리: `packages/board/src/PostList.stories.tsx` · `packages/board/src/PostDetail.stories.tsx` · `packages/board/src/PostEditor.stories.tsx` · `packages/board/src/CommentThread.stories.tsx` · `packages/board/src/BoardComments.stories.tsx` · `packages/board/src/ReactionBar.stories.tsx` · `packages/board/src/BoardPage.stories.tsx`
- 복사해 시작할 Patterns: `apps/storybook/src/patterns/ListPage.stories.tsx` · `apps/storybook/src/patterns/DetailPage.stories.tsx` · `apps/storybook/src/patterns/FormPage.stories.tsx`
- 문서: `packages/board/README.md`
- 쓰지 않는 경우: 채팅 · 피드 · 실시간 대화 — 글 + 댓글 트리 모델이다 / 반응의 글자 · 아이콘은 패키지가 모른다 — 서버가 준 코드에 labels/icons 맵 prop 을 앱이 준다 / 게시판 만들기(관리)는 운영자 API — 화면은 없다
- 키워드: 게시판, 커뮤니티, 글쓰기, 댓글, 대댓글, 공감, 좋아요, 반응, 게시글, 운영자 숨김, 공지 고정 / board, forum, community, post, comment, reply, thread, reaction, like, moderation, bulletin board

### `storage` — 파일 업로드 — 검증 → presign → 브라우저에서 스토리지로 직접 PUT(진행률 · 취소 · 멀티파트)과 useUpload 훅.

- 종류 · 상태: package · stable
- 위치: `@skeleton/storage` (`packages/storage`)
- 켜는 법: `--packages storage` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` · `--with-workbench` 로도 따라온다
- 필요한 것: `api-client`
- 백엔드: 모듈 `storage` · `storage-s3` · 경로 `/api/v1/storage`
- 주요 진입점: `createStorageApi` · `createUploader` · `useUpload` · `validateFile` · `storageEndpoints` · `createXhrTransport`
- 보고 따라 할 스토리: `packages/storage/src/useUpload.stories.tsx` · `packages/ui/src/FilePicker/FilePicker.stories.tsx` · `packages/ui/src/Progress/Progress.stories.tsx`
- 문서: `packages/storage/README.md`
- 쓰지 않는 경우: 이미지 리사이즈 · 변환은 하지 않는다 / 업로드 화면 한 장(Pattern)은 없다 — FilePicker + useUpload + Progress 를 상세 화면의 한 구역으로 조립한다
- 키워드: 파일 업로드, 이미지 업로드, 첨부파일, 프리사인, 대용량 업로드, 멀티파트, S3 / file upload, image upload, attachment, presigned url, multipart, s3, r2, upload progress

### `payment` — 결제 계약 — 토스 성공 리다이렉트를 승인 요청으로 바꾸고 승인/취소/환불을 부르는 얇은 클라이언트(경로는 앱이 정한다).

- 종류 · 상태: package · experimental
- 위치: `@skeleton/payment` (`packages/payment`)
- 켜는 법: `--packages payment` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-workbench` 로도 따라온다
- 필요한 것: `api-client`
- 백엔드: 모듈 `payment` · `payment-toss` | `payment-stripe` 중 하나 이상 · HTTP 를 열지 않는다(앱이 컨트롤러를 둔다)
- 주요 진입점: `createPaymentApi` · `confirmRequestFromTossRedirect` · `isPaymentError` · `PAYMENT_ERROR_CODES` · `PaymentRedirectError`
- 문서: `packages/payment/README.md`
- 쓰지 않는 경우: 결제 위젯 · 결제창 UI 는 없다 — 토스 SDK 를 앱이 붙인다 / 백엔드 모듈이 HTTP 를 열지 않는다 — 주문 · 금액 검증 · 웹훅 컨트롤러는 백엔드 앱 코드(그래서 이 패키지는 기본 경로를 가정하지 않는다) / Stripe 리다이렉트 변환은 없다(토스만) · 구독 관리 화면 없음
- 키워드: 결제, 토스, 스트라이프, 환불, 카드 결제, 결제 승인, 유료 / payment, toss, stripe, checkout, refund, billing, paid

### `captcha-turnstile` — 봇 방지 — Cloudflare Turnstile 스크립트 로더 · <Turnstile> · 토큰 훅 · 요청에 토큰 붙이기.

- 종류 · 상태: package · stable
- 위치: `@skeleton/captcha-turnstile` (`packages/captcha-turnstile`)
- 켜는 법: `--packages captcha-turnstile` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-workbench` 로도 따라온다
- 백엔드: 모듈 `captcha-turnstile` · HTTP 를 열지 않는다(앱이 컨트롤러를 둔다)
- 주요 진입점: `loadTurnstile` · `Turnstile` · `useTurnstileToken` · `attachTurnstileToken` · `turnstileHeaders`
- 보고 따라 할 스토리: `packages/captcha-turnstile/src/Turnstile.stories.tsx`
- 문서: `packages/captcha-turnstile/README.md`
- 쓰지 않는 경우: 토큰 검증은 백엔드(TurnstileVerifier)가 한다 — 이 패키지는 받아서 붙이기만 / reCAPTCHA · hCaptcha 는 없다
- 키워드: 캡차, 봇 방지, 스팸 방지, 로봇 확인, 가입 폼 보호 / captcha, turnstile, bot protection, cloudflare, spam protection

### `seo` — 검색 · 공유 미리보기 — 제목 · 설명 · canonical · OG/Twitter · hreflang · JSON-LD 를 SPA(effect)와 SSR(문자열)에서 같은 규칙으로, 빌드 때 sitemap.xml · robots.txt 까지.

- 종류 · 상태: package · stable
- 위치: `@skeleton/seo` (`packages/seo`)
- 켜는 법: `--packages seo` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--ssr` · `--with-sample` 로도 따라온다
- 백엔드: 없음(프런트만)
- 주요 진입점: `buildHeadSpec` · `renderHeadHtml` · `useSeo` · `Seo` · `SeoProvider` · `applyHead` · `sitemapXml` · `robotsTxt` · `faqLd` · `breadcrumbLd` · `@skeleton/seo/vite#seoFiles`
- 보고 따라 할 스토리: `packages/seo/src/Seo.stories.tsx`
- 문서: `packages/seo/README.md`
- 쓰지 않는 경우: 분석 · 추적 코드는 없다 / SPA 는 첫 HTML 이 비어 링크 미리보기 크롤러가 머리를 못 읽는다 — 노출이 중요하면 서버 렌더 앱(app-starter-ssr)
- 키워드: 검색 노출, SEO, 메타 태그, OG 이미지, 링크 미리보기, 사이트맵, 구조화 데이터 / seo, meta tags, open graph, twitter card, canonical, sitemap, robots.txt, json-ld

### `marketing` — 공개 페이지 조립 부품 — Hero · 기능 · FAQ · 후기 · CTA · 푸터 · 요금제(월/연) · 쿠키 동의 · 약관 문서 페이지 · 404/500/점검 화면.

- 종류 · 상태: package · stable
- 위치: `@skeleton/marketing` (`packages/marketing`)
- 켜는 법: `--packages marketing` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` 로도 따라온다
- 필요한 것: `time` · `ui`
- 백엔드: 없음(프런트만)
- 주요 진입점: `Hero` · `FeatureGrid` · `FaqAccordion` · `Testimonial` · `CtaBand` · `SiteFooter` · `PricingTable` · `ConsentBanner` · `createConsentStore` · `LegalDocumentPage` · `NotFoundPage` · `ServerErrorPage` · `MaintenancePage`
- 보고 따라 할 스토리: `packages/marketing/src/sections/Sections.stories.tsx` · `packages/marketing/src/pricing/PricingTable.stories.tsx` · `packages/marketing/src/consent/ConsentBanner.stories.tsx` · `packages/marketing/src/legal/LegalDocumentPage.stories.tsx` · `packages/marketing/src/status/StatusPage.stories.tsx`
- 복사해 시작할 Patterns: `packages/marketing/src/patterns/Landing.stories.tsx` · `packages/marketing/src/patterns/Pricing.stories.tsx` · `packages/marketing/src/patterns/LegalDocument.stories.tsx` · `packages/marketing/src/patterns/NotFound.stories.tsx`
- 문서: `packages/marketing/README.md`
- 쓰지 않는 경우: 법적 효력이 있는 약관 — 템플릿일 뿐이다(법률 검토 필요) / 분석 · 추적 — 동의 저장소만 있고 추적 코드는 없다 / 블로그 · CMS 콘텐츠 관리는 없다
- 키워드: 랜딩, 랜딩 페이지, 홈페이지, 요금제, 가격표, FAQ, 약관, 개인정보처리방침, 쿠키 동의, 404 페이지, 푸터 / landing page, marketing site, pricing table, faq, terms of service, privacy policy, cookie consent, 404 page, hero, footer

### `legal` — 법적 문서 · 동의 — 서버의 약관 읽기(마크다운 · 판 · 효력일) · 가입 동의 체크리스트(필수/선택 · 전체 동의 · 문서 다이얼로그) · 첫 로그인과 새 판 재동의(403 LEGAL.RECONSENT_REQUIRED 를 api-client 계층에서 받아 동의 뒤 막힌 호출을 다시 보낸다) · 동의 설정(이력 · 선택 동의 철회).

- 종류 · 상태: package · stable
- 위치: `@skeleton/legal` (`packages/legal`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `api-client` · `ui`
- 백엔드: 모듈 `legal` · `legal-jdbc` · 경로 `/api/v1/legal`
- 주요 진입점: `createLegalApi` · `createReconsentController` · `ReconsentGate` · `SignUpConsents` · `ConsentChecklist` · `ConsentSettings` · `ApiLegalDocumentPage` · `DocumentDialog` · `useLegalDocuments` · `useMyConsents`
- 보고 따라 할 스토리: `packages/legal/src/ConsentChecklist.stories.tsx` · `packages/legal/src/SignUpConsents.stories.tsx` · `packages/legal/src/ReconsentGate.stories.tsx` · `packages/legal/src/ConsentSettings.stories.tsx` · `packages/legal/src/ApiLegalDocumentPage.stories.tsx`
- 문서: `packages/legal/README.md`
- 쓰지 않는 경우: 백엔드가 없거나 legal 모듈이 없는 사이트의 정적 약관은 marketing 의 LegalDocumentPage 를 쓴다 / 문서 본문 · 사실(회사명 …) · 검토 상태는 백엔드 소관이다 — 이 패키지는 서버가 준 마크다운을 그린다 / 쿠키 · 추적 동의는 marketing 의 ConsentBanner(브라우저 저장)
- 키워드: 약관 동의, 가입 동의 체크박스, 재동의, 개인정보 동의, 마케팅 수신 동의, 동의 철회, 약관 개정 / terms consent, sign-up consent checkbox, re-consent, privacy consent, marketing opt-in, withdraw consent, terms update

### `time` — 글로벌 시간 — 순간 · 달력 날짜 · 현지+내 시간대 3종 포맷, 서버 시각 보정(카운트다운), 국가→시간대, 오늘의 날짜.

- 종류 · 상태: package · stable
- 위치: `@skeleton/time` (`packages/time`)
- 켜는 법: 모든 프로젝트에 들어간다
- 백엔드: 모듈 `time` · HTTP 를 열지 않는다(앱이 컨트롤러를 둔다)
- 주요 진입점: `formatInstant` · `formatDate` · `formatDual` · `formatRelative` · `todayInZone` · `createServerClock` · `userTimeZone`
- 보고 따라 할 스토리: `packages/time/src/formats.stories.tsx`
- 문서: `packages/time/README.md`
- 쓰지 않는 경우: 문구 번역 → i18n / new Date('YYYY-MM-DD') 로 달력 날짜를 만들지 않는다 — formatDate
- 키워드: 시간, 날짜 표시, 시간대, 타임존, 서버 시각, 카운트다운, 상대 시간 / time, date format, timezone, server clock, countdown, relative time

### `theme` — 라이트/다크/시스템 테마 — 토글 · 토스트 테마 · 첫 칠 전 스크립트(깜빡임 방지) · Vite 플러그인.

- 종류 · 상태: package · stable
- 위치: `@skeleton/theme` (`packages/theme`)
- 켜는 법: 모든 프로젝트에 들어간다
- 백엔드: 없음(프런트만)
- 주요 진입점: `initTheme` · `useTheme` · `setTheme` · `ThemeToggle` · `ThemedToaster` · `PRE_PAINT_SCRIPT` · `@skeleton/theme/vite#themePrePaint`
- 보고 따라 할 스토리: `packages/theme/src/ThemeToggle.stories.tsx` · `packages/theme/src/ThemedToaster.stories.tsx`
- 문서: `packages/theme/README.md`
- 쓰지 않는 경우: 색 값을 정하는 곳이 아니다 → tokens (theme 는 data-theme 전환만)
- 키워드: 다크 모드, 테마, 라이트 모드, 다크 테마 / dark mode, theme, light mode, color scheme

### `tokens` — 디자인 토큰 — 색 · 간격 · 모서리 · 글자 크기의 단일 정본(tokens.json)과 생성기 → tokens.css(라이트/다크), 날값 검출 테스트 도구.

- 종류 · 상태: package · stable
- 위치: `@skeleton/tokens` (`packages/tokens`)
- 켜는 법: 모든 프로젝트에 들어간다
- 백엔드: 없음(프런트만)
- 주요 진입점: `findRawColors` · `findRawLayout` · `contrast` · `themeVars`
- 보고 따라 할 스토리: `apps/storybook/src/tokens/Tokens.stories.tsx`
- 문서: `packages/tokens/README.md` · `docs/design-tokens.md`
- 쓰지 않는 경우: 화면 CSS 에 색 · 간격 날값을 쓰지 않는다 — var(--…) 의미 토큰 / 생성물(tokens.css · docs/design-tokens.md 표)을 손으로 고치지 않는다 — pnpm tokens
- 키워드: 디자인 토큰, 색상, 브랜드 색, 간격, 디자인 시스템, 색 바꾸기 / design tokens, colors, brand color, spacing, design system, css variables

### `ui` — 화면 부품 — Button · Input/Field · Select · Table · Pagination · Dialog · Tabs · AppShell · Combobox · DatePicker · MarkdownView 등, 모두 스토리 + play + 접근성 테스트.

- 종류 · 상태: package · stable
- 위치: `@skeleton/ui` (`packages/ui`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `api-client` · `time`
- 백엔드: 없음(프런트만)
- 주요 진입점: `Button` · `Input` · `Field` · `Select` · `Table` · `Pagination` · `Dialog` · `Tabs` · `AppShell` · `PageHeader` · `EmptyState` · `showApiError` · `toastPromise`
- 보고 따라 할 스토리: `packages/ui/src/Button/Button.stories.tsx` · `packages/ui/src/Field/Field.stories.tsx` · `packages/ui/src/Table/Table.stories.tsx` · `packages/ui/src/Dialog/Dialog.stories.tsx` · `packages/ui/src/AppShell/AppShell.stories.tsx`
- 복사해 시작할 Patterns: `apps/storybook/src/patterns/DashboardPage.stories.tsx` · `apps/storybook/src/patterns/ListPage.stories.tsx` · `apps/storybook/src/patterns/FormPage.stories.tsx` · `apps/storybook/src/patterns/DetailPage.stories.tsx` · `apps/storybook/src/patterns/LoginPage.stories.tsx` · `apps/storybook/src/patterns/SettingsPage.stories.tsx`
- 문서: `packages/ui/README.md` · `docs/ui-catalog.md`
- 쓰지 않는 경우: 날 <button> · <input> · <select> · <textarea> · <dialog> 를 쓰지 않는다 — ESLint 가 막는다 / 부품이 API 를 부르지 않는다(props 만) · 사용자에게 보이는 문구는 prop
- 키워드: 버튼, 입력창, 폼, 표, 테이블, 모달, 다이얼로그, 탭, 페이지네이션, 레이아웃, 컴포넌트, 드롭다운, 토스트, 날짜 선택 / button, input, form, table, modal, dialog, tabs, pagination, layout, components, dropdown, toast, date picker

### `app-starter` — SPA 스타터 — 라우터 · AppShell · 테마 토글 · API 클라이언트 · 로그인 · 보호 라우트가 이어진 출발점(새 프로젝트의 앱이 된다).

- 종류 · 상태: app · stable
- 위치: `starter` (`apps/starter`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `api-client` · `auth` · `theme` · `time` · `tokens` · `ui`
- 백엔드: 모듈 `account` · `account-jdbc` · `alert` · `auth` · `auth-session` · `auth-session-jdbc` · `auth-social` · `captcha-turnstile` · `db-postgresql` · `idempotency` · `job-queue-jdbc` · `legal` · `legal-jdbc` · `migration` · `migration-flyway` · `notification-mail` · `persistence-jdbc` · `platform` · `time` · 경로 `/api/v1` · 짝 앱 `apps/api`
- 주요 진입점: `apps/starter/src/main.tsx` · `apps/starter/src/routes/routes.tsx` · `apps/starter/src/api/client.ts` · `apps/starter/src/auth/session.ts` · `apps/starter/src/layouts/RootLayout.tsx`
- 문서: `CLAUDE.md`
- 쓰지 않는 경우: 서버가 첫 HTML 을 그려야 하면(검색 노출 · 링크 미리보기) → app-starter-ssr / 복사 후 안 쓰는 것은 지운다 — 스타터는 최소다
- 키워드: 스타터, SPA, 시작 템플릿, 새 앱, 프런트 시작 / starter, spa, boilerplate, vite react, frontend start

### `app-starter-ssr` — 서버 렌더 스타터 — Node 서버가 첫 응답을 그리고 브라우저가 이어받는다(plain Vite SSR · Dockerfile · 라우트별 제목 · 설명 · 데이터 미리 가져오기).

- 종류 · 상태: app · stable
- 위치: `starter-ssr` (`apps/starter-ssr`)
- 켜는 법: `--ssr` — 함께 따라오는 패키지 `seo`
- 필요한 것: `api-client` · `auth` · `seo` · `theme` · `time` · `tokens` · `ui`
- 백엔드: 모듈 `account` · `account-jdbc` · `alert` · `auth` · `auth-session` · `auth-session-jdbc` · `auth-social` · `captcha-turnstile` · `db-postgresql` · `idempotency` · `job-queue-jdbc` · `legal` · `legal-jdbc` · `migration` · `migration-flyway` · `notification-mail` · `persistence-jdbc` · `platform` · `time` · 경로 `/api/v1` · 짝 앱 `apps/api`
- 주요 진입점: `apps/starter-ssr/server/main.ts` · `apps/starter-ssr/src/entry-server.tsx` · `apps/starter-ssr/src/entry-client.tsx` · `apps/starter-ssr/src/routes/routes.tsx` · `apps/starter-ssr/Dockerfile`
- 문서: `apps/starter-ssr/README.md` · `CLAUDE.md`
- 쓰지 않는 경우: 로그인 뒤 앱(대시보드)은 SPA 로 충분하다 → app-starter / 렌더 중 window · localStorage · 난수 · 시각을 읽지 않는다(하이드레이션 어긋남) / --ssr 은 SPA 스타터를 대신한다(둘 다 찍을 수 없다)
- 키워드: 서버 렌더링, SSR, 검색 노출, 첫 화면 빠르게, 콘텐츠 사이트, 링크 미리보기 / ssr, server-side rendering, seo, node server, hydration, content site

### `app-sample` — 참조 앱 Notes — Patterns 로 조립한 작지만 실제 같은 제품(랜딩 · 로그인 · 대시보드 · 목록 · 상세 · 폼 · 첨부 · 알림 · 게시판 · 다국어 · 설정 · 404), 새 기능은 이 앱의 한 조각을 따라 한다.

- 종류 · 상태: app · template-only
- 위치: `sample` (`apps/sample`)
- 켜는 법: `--with-sample` — 함께 따라오는 패키지 `board` · `i18n` · `marketing` · `notifications` · `realtime` · `seo` · `storage`
- 필요한 것: `api-client` · `auth` · `board` · `i18n` · `marketing` · `notifications` · `realtime` · `seo` · `storage` · `theme` · `time` · `tokens` · `ui`
- 백엔드: 모듈 `account` · `account-jdbc` · `alert` · `alert-jdbc` · `auth` · `auth-magic-link` · `auth-session` · `auth-session-jdbc` · `auth-social` · `board` · `board-jdbc` · `captcha-turnstile` · `crypto` · `db-postgresql` · `idempotency` · `job-queue-jdbc` · `json` · `legal` · `legal-jdbc` · `migration` · `migration-flyway` · `notification` · `notification-jdbc` · `notification-mail` · `notification-sse` · `persistence-jdbc` · `platform` · `storage` · `storage-s3` · `time` · 경로 `/api/v1/notes` · 짝 앱 `apps/sample`
- 주요 진입점: `apps/sample/src/routes/routes.tsx` · `apps/sample/src/layouts/RootLayout.tsx` · `apps/sample/src/i18n/index.ts` · `apps/sample/src/board/api.ts` · `apps/sample/src/notifications/useLiveNotifications.ts` · `apps/sample/src/routes/LandingPage.tsx`
- 문서: `apps/sample/README.md`
- 쓰지 않는 경우: 제품 코드가 아니다 — 화면마다 어느 Pattern 으로 짰는지 보고 따라 하는 참조(README 의 「화면 → Pattern」 표) / 백엔드는 kotlin-skeleton 의 apps/sample 과 짝(PostgreSQL 전용) — 다른 백엔드에는 맞지 않는다
- 키워드: 참조 앱, 예제 앱, 샘플, 제품 모양, 노트 앱, 화면 조립 예 / reference app, sample app, example, demo product, notes app

### `app-storybook` — 스토리집 — 모든 부품 · 복사해 시작하는 화면 틀(Patterns) · 토큰을 백엔드 없이 보고, 진짜 브라우저로 동작 · 접근성을 테스트한다.

- 종류 · 상태: app · stable
- 위치: `storybook-app` (`apps/storybook`)
- 켜는 법: 기본으로 들어간다 (빼려면 `--without-storybook`)
- 필요한 것: `tokens` · `ui`
- 백엔드: 없음(프런트만)
- 주요 진입점: `apps/storybook/.storybook/main.ts` · `apps/storybook/.storybook/preview.tsx` · `apps/storybook/src/tokens/Tokens.stories.tsx`
- 복사해 시작할 Patterns: `apps/storybook/src/patterns/DashboardPage.stories.tsx` · `apps/storybook/src/patterns/ListPage.stories.tsx` · `apps/storybook/src/patterns/FormPage.stories.tsx` · `apps/storybook/src/patterns/DetailPage.stories.tsx` · `apps/storybook/src/patterns/LoginPage.stories.tsx` · `apps/storybook/src/patterns/ForbiddenPage.stories.tsx` · `apps/storybook/src/patterns/SettingsPage.stories.tsx`
- 문서: `docs/ui-catalog.md` · `docs/design-tokens.md`
- 쓰지 않는 경우: 제품에 배포하는 앱이 아니다(개발 · 문서용) / 스토리집 없이 가볍게 찍으려면 new-project.sh --without-storybook
- 키워드: 스토리북, 스토리집, 화면 틀, 컴포넌트 카탈로그, 접근성 테스트, 컴포넌트 문서 / storybook, component catalog, patterns, a11y test, component docs

### `app-workbench` — 백엔드 확인용 시각적 테스트 벤치 — 백엔드 모듈을 눌러 보는 화면들과 /packages 예제 화면.

- 종류 · 상태: app · experimental
- 위치: `workbench` (`apps/workbench`)
- 켜는 법: `--with-workbench` — 함께 따라오는 패키지 `captcha-turnstile` · `notifications` · `payment` · `realtime` · `storage`
- 필요한 것: `api-client` · `auth` · `captcha-turnstile` · `notifications` · `payment` · `realtime` · `storage` · `theme` · `time` · `tokens` · `ui`
- 백엔드: 모듈 `account` · `account-jdbc` · `alert` · `alert-jdbc` · `async` · `async-notification` · `auth` · `auth-magic-link` · `auth-session` · `auth-session-jdbc` · `auth-social` · `auth-social-google` · `auth-social-kakao` · `auth-social-naver` · `board` · `board-jdbc` · `captcha-turnstile` · `config-aws-ssm` · `crypto` · `db-postgresql` · `event-kafka` · `idempotency` · `job-queue-jdbc` · `json` · `legal` · `legal-jdbc` · `migration` · `migration-flyway` · `notification` · `notification-jdbc` · `notification-mail` · `notification-slack` · `notification-sse` · `notification-websocket` · `payment` · `payment-stripe` · `payment-toss` · `persistence-jdbc` · `persistence-jpa` · `platform` · `redis-cache` · `redis-core` · `redis-lock` · `redis-rate-limit` · `scheduler` · `storage` · `storage-s3` · `time` · 경로 `/api/v1` · `/api/v1/examples` · `/api/v1/skeleton` · `/api/v1/skeleton/enums` · `/api/v1/skeleton/json` · `/api/v1/skeleton/payments` · `/api/v1/skeleton/polymorphic/contents` · 짝 앱 `apps/workbench`
- 주요 진입점: `apps/workbench/src/main.tsx` · `apps/workbench/src/routes/index.tsx`
- 쓰지 않는 경우: 복사 대상이 아니다 — 스타터가 워크벤치를 모른다(날 요소 · 인라인 스타일 예외 앱) / 제품 화면의 모범은 app-sample 과 Patterns
- 키워드: 워크벤치, 백엔드 확인, 시각적 테스트, 모듈 데모 / workbench, backend smoke test, visual test bench, module demo

### `social-login` — 소셜 로그인의 프런트 절반 — 제공자 인가 주소 · state 검증(탭에 묶임 · 한 번만) · 콜백의 code 를 백엔드로 보내 로그인 처리, 로그인한 계정에 제공자를 더하는 연결 흐름(createSocialLinkFlow). 버튼 · 콜백 화면은 SignInScreen · createAuthRoutes 가 그린다.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/auth` (`packages/auth/src/social.ts`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `auth`
- 백엔드: 모듈 `auth-social` · `auth-social-google` | `auth-social-kakao` | `auth-social-naver` 중 하나 이상 · 경로 `/api/v1/auth/social`
- 주요 진입점: `createSocialLoginFlow` · `createSocialLinkFlow` · `useSocialLoginCallback` · `buildAuthorizeUrl` · `parseSocialCallback` · `SOCIAL_AUTHORIZE_PRESETS` · `SocialCallbackScreen`
- 복사해 시작할 Patterns: `packages/auth/src/patterns/SignIn.stories.tsx` · `packages/auth/src/patterns/MailLinkLandings.stories.tsx`
- 문서: `packages/auth/README.md`
- 쓰지 않는 경우: clientSecret 은 프런트에 두지 않는다 — 백엔드 skeleton.auth-social.providers.* 에만 / 이메일 가입 · 계정 연결 정책은 백엔드 — 앱이 병합을 켜 두면(skeleton.account.social.merge-on-verified-email, 샘플 · 스타터 백엔드는 켠다) 확인된 제공자 이메일은 기존 계정으로 바로 로그인되고, 꺼 두면 ACCOUNT.SOCIAL_EMAIL_CONFLICT(409)가 나온다 — 화면은 둘 다 다룬다. 연결 · 병합은 계정 주소로 알림 메일이 간다 / 제공자마다 콜백 주소 · clientId 를 콘솔에 등록해야 한다(VITE_SOCIAL_<제공자>_CLIENT_ID)
- 키워드: 소셜 로그인, 구글 로그인, 카카오 로그인, 네이버 로그인, 간편 로그인, OAuth / social login, google login, kakao login, naver login, oauth, sso

### `account-lifecycle` — 계정 수명주기 화면 한 벌 — 가입(서버 정책 힌트 · 캡차 · 동의 슬롯 · 메일로 받은 6자리 인증번호를 같은 화면에서 입력하면 바로 로그인) · 비밀번호 재설정 · 링크 로그인 도착 · 로그인(방법은 백엔드가 알려 준다) · 계정 설정(이메일 변경 · 첫 비밀번호 · 소셜 연결/해제 · 삭제의 다시 인증은 비밀번호 · 메일 인증번호(그 자리에서 입력) · 제공자 동의 중 계정에 맞는 하나, 이메일 변경 대기는 서버가 말해 준다) · 오래된 메일 링크 안내 · 정지/차단 안내. createAuthRoutes 가 라우트까지 한 번에.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/auth` (`packages/auth/src/routes/createAuthRoutes.tsx`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `auth`
- 백엔드: 모듈 `account` · `account-jdbc` · `auth-session` · `auth-session-jdbc` · 경로 `/api/v1/account` · `/api/v1/auth`
- 주요 진입점: `createAuthRoutes` · `SignInScreen` · `SignUpScreen` · `VerifyCodePanel` · `ReauthProof` · `ForgotPasswordScreen` · `ResetPasswordScreen` · `AccountSettings` · `AccountStateNotice` · `defaultAuthLabels` · `koAuthLabels`
- 복사해 시작할 Patterns: `packages/auth/src/patterns/SignUp.stories.tsx` · `packages/auth/src/patterns/MailLinkLandings.stories.tsx` · `packages/auth/src/patterns/AccountSettings.stories.tsx`
- 문서: `packages/auth/README.md`
- 쓰지 않는 경우: 메일을 보내는 쪽(notification-mail)과 링크 주소(skeleton.account.mail.link-base-url)는 백엔드 설정 — 프런트의 /reset-password · /magic-link 경로와 맞춘다(링크가 남은 곳은 그 둘뿐 — 가입 인증 · 이메일 변경 · 다시 인증 · 삭제 확인은 6자리 인증번호) / 로그인 방법은 백엔드 GET /auth/methods 가 알려 준다(로딩 · 실패 대체 화면 포함) — 환경변수 VITE_AUTH_METHODS 는 그것을 덮어쓰는 선택일 뿐이다. 리프레시 전달 방식(body · cookie)만은 앱이 시작할 때 정하므로 VITE_AUTH_REFRESH_DELIVERY 가 백엔드와 같아야 한다(다르면 개발 콘솔에 경고) / 동의(약관 판) 저장은 없다 — 슬롯이 체크한 판을 콜백으로 보고할 뿐 / 이메일 주소가 없는 계정(Naver 등)의 다시 인증은 제공자 동의 왕복이다 — 하려던 작업과 계정은 OAuth state 기록에 묶이고(sessionStorage · 한 번 읽으면 지워진다) 돌아오면 설정 화면이 한 번만 이어서 한다. 서버에 이메일 변경 취소 엔드포인트는 없다(새 요청이 대신하거나 만료). PKCE 는 아직 없다(백엔드가 미룸)
- 키워드: 회원가입, 가입 화면, 이메일 인증, 메일 확인, 비밀번호 재설정, 비밀번호 찾기, 계정 설정, 프로필, 로그인 세션 관리, 계정 삭제, 정지된 계정 / sign up, registration screen, verify email, check your email, reset password, forgot password, account settings, profile, active sessions, delete account, suspended account

### `session-refresh` — 액세스 토큰 자동 갱신 — 401 이면 갱신을 한 번으로 합쳐(single-flight) 요청을 한 번만 다시 보낸다. 회전하는 리프레시 토큰을 안전하게 저장하고 탭 사이를 락 · storage 이벤트로 맞추며, 재사용 · 만료 때는 깨끗이 로그아웃. body · cookie 모드.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/auth` (`packages/auth/src/sessionRefresher.ts`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `auth`
- 백엔드: 모듈 `auth-session` · `auth-session-jdbc` · 경로 `/api/v1/auth/refresh` · `/api/v1/auth/logout`
- 주요 진입점: `createSessionRefresher` · `createRefreshStore` · `createTokenStore` · `createAuthSession`
- 문서: `packages/auth/README.md`
- 쓰지 않는 경우: body 모드(기본)의 리프레시 토큰은 JS 가 쥔다 — localStorage 에 두면 XSS 에 노출된다. 쿠키 모드(HttpOnly)는 한 줄 스위치(apps/*/src/auth/authConfig.ts 의 DEFAULT_REFRESH_DELIVERY 또는 VITE_AUTH_REFRESH_DELIVERY=cookie)와 백엔드 skeleton.auth-session.delivery=cookie 를 함께 켠다(프런트 · API 가 같은 사이트여야 한다 — SameSite=Strict) / 서버가 세션을 끊어도 이미 발급된 액세스 토큰은 만료(최대 15분)까지 산다 / 갱신 도중 페이지가 이동해 응답을 잃으면: 백엔드 reuse-grace(샘플 · 스타터는 10s)가 있으면 이어지고, 모듈 기본 0s 면 탈취로 보고 세션이 닫힌다(재로그인) — 클라이언트는 한 번 깨끗이 로그아웃하고 멈춘다
- 키워드: 토큰 갱신, 리프레시 토큰, 자동 로그인 유지, 세션 만료, 탭 동기화 / token refresh, refresh token, silent refresh, session expiry, cross-tab sync

### `magic-link-login` — 이메일 링크 로그인 — 로그인 화면의 「링크 받기」 · 메일 확인 안내 · 링크를 열면 로그인되는 도착 화면. 비밀번호 없이 쓰거나 비밀번호와 나란히 켠다.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/auth` (`packages/auth/src/screens/MagicLinkLanding.tsx`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `auth`
- 백엔드: 모듈 `auth-magic-link` · 경로 `/api/v1/auth/magic-link`
- 주요 진입점: `SignInScreen` · `MagicLinkLanding` · `createAuthRoutes`
- 복사해 시작할 Patterns: `packages/auth/src/patterns/SignIn.stories.tsx` · `packages/auth/src/patterns/MailLinkLandings.stories.tsx`
- 문서: `packages/auth/README.md`
- 쓰지 않는 경우: 링크는 15분 · 한 번만 — 도착 화면은 열자마자 한 번만 호출한다 / 없는 주소로 가입까지 해 줄지는 백엔드 skeleton.auth-magic-link.sign-up / 이미 있는 계정은 가입이 닫혀 있어도 링크로 들어온다. 비밀번호가 미확인인 계정은 링크로 들어오면 가입 때 정한 비밀번호가 버려진다 — 설정은 「비밀번호 없음」으로 보인다
- 키워드: 링크 로그인, 매직링크, 비밀번호 없는 로그인, 이메일 로그인 / magic link, passwordless, email sign in

### `account-admin` — 운영자 계정 표(선택 내보내기 @skeleton/auth/admin) — 검색 · 상태 필터 · 정지 · 해제 · 삭제 유예 복구 · 역할 부여/회수.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/auth` (`packages/auth/src/admin/AdminAccounts.tsx`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `auth`
- 백엔드: 모듈 `account` · 경로 `/api/v1/admin/accounts`
- 주요 진입점: `@skeleton/auth/admin#AdminAccounts` · `@skeleton/auth/admin#AdminAccountsTable` · `@skeleton/auth/admin#createAdminAccountsApi`
- 복사해 시작할 Patterns: `packages/auth/src/admin/AdminAccounts.stories.tsx`
- 문서: `packages/auth/README.md`
- 쓰지 않는 경우: 백엔드 skeleton.account.admin.enabled=true 와 ADMIN 역할이 있어야 열린다(RequireRole 은 화면용, 검사는 서버) / 사용자 지원용 상세 · 감사 로그 화면은 없다
- 키워드: 운영자 도구, 계정 관리, 계정 정지, 관리자 화면 / admin tools, account management, suspend account, admin panel

### `live-notifications` — 알림이 새로고침 없이 즉시 뜬다 — 실시간 연결(SSE 또는 WebSocket)로 받은 이벤트를 알림 캐시에 넣어 종 · 목록 · 안 읽은 수가 바로 바뀐다.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/notifications` (`packages/notifications/src/hooks.ts`)
- 켜는 법: `--packages notifications` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` · `--with-workbench` 로도 따라온다
- 필요한 것: `notifications` · `realtime`
- 백엔드: `notification-sse` | `notification-websocket` 중 하나 이상 · 경로 `/api/v1/notifications/sse`
- 주요 진입점: `useNotificationIngest` · `createInboxSync` · `parseNotificationEvent` · `useNotifications` · `useUnreadCount` · `NotificationBell`
- 문서: `packages/notifications/README.md` · `packages/realtime/README.md` · `apps/sample/src/notifications/useLiveNotifications.ts`
- 쓰지 않는 경우: 연결이 끊겨도 목록 조회(REST)는 동작한다 — 실시간은 보태기일 뿐 / 알림을 만드는 쪽(백엔드 NotificationPublisher.publish)은 이 패턴이 아니다
- 키워드: 실시간 알림, 알림 즉시 표시, 푸시 알림, 알림 종 실시간 / live notifications, realtime notifications, push notifications, sse notifications

### `landing-page` — 공개 첫 화면 — Hero · 기능 · 한마디 · 요금제 · FAQ · 마지막 권유 · 푸터를 Patterns/Landing 한 장으로 조립해 시작한다.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/marketing` (`packages/marketing/src/patterns/Landing.stories.tsx`)
- 켜는 법: `--packages marketing` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` 로도 따라온다
- 필요한 것: `marketing`
- 백엔드: 없음(프런트만)
- 주요 진입점: `Hero` · `FeatureGrid` · `Testimonial` · `FaqAccordion` · `CtaBand` · `SiteFooter` · `PricingTable`
- 보고 따라 할 스토리: `packages/marketing/src/sections/Sections.stories.tsx`
- 복사해 시작할 Patterns: `packages/marketing/src/patterns/Landing.stories.tsx`
- 문서: `packages/marketing/README.md` · `apps/sample/src/routes/LandingPage.tsx`
- 쓰지 않는 경우: 검색 노출이 목적이면 seo(머리 · 사이트맵)와 서버 렌더(app-starter-ssr)를 함께 / 문구 · 이미지 · 가격은 프로젝트가 채운다(Pattern 은 자리만 준다)
- 키워드: 랜딩, 랜딩 페이지, 홍보 페이지, 첫 화면, 홈페이지 / landing page, homepage, marketing page, hero section

### `pricing-page` — 요금제 페이지 — 월/연 토글 · 절약 % · 강조 요금제 · 문의형 · 결제 질문 FAQ 를 데이터(plans)로 그리고 선택은 onSelect 로 받는다.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/marketing` (`packages/marketing/src/patterns/Pricing.stories.tsx`)
- 켜는 법: `--packages marketing` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` 로도 따라온다
- 필요한 것: `marketing`
- 백엔드: 없음(프런트만)
- 주요 진입점: `PricingTable` · `formatPrice` · `monthlyEquivalent` · `savingsPercent`
- 보고 따라 할 스토리: `packages/marketing/src/pricing/PricingTable.stories.tsx`
- 복사해 시작할 Patterns: `packages/marketing/src/patterns/Pricing.stories.tsx`
- 문서: `packages/marketing/README.md`
- 쓰지 않는 경우: 실제 결제는 하지 않는다 — onSelect 에서 payment 로 잇는다 / 가격 데이터 · 통화는 프로젝트가 정한다
- 키워드: 요금제, 가격표, 플랜, 월 연 결제 토글, 구독 요금 / pricing page, pricing table, plans, subscription pricing

### `legal-documents` — 약관 · 개인정보처리방침 페이지 — 판(版) 바꾸기 · 효력일 · 옛 판 안내 · 「템플릿」 표시 · 사실({{키}}) 채우기, 문서는 마크다운.

- 종류 · 상태: pattern · template-only
- 위치: `@skeleton/marketing` (`packages/marketing/src/patterns/LegalDocument.stories.tsx`)
- 켜는 법: `--packages marketing` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` 로도 따라온다
- 필요한 것: `marketing`
- 백엔드: 없음(프런트만)
- 주요 진입점: `LegalDocumentPage` · `currentVersionOf` · `sortVersions`
- 보고 따라 할 스토리: `packages/marketing/src/legal/LegalDocumentPage.stories.tsx`
- 복사해 시작할 Patterns: `packages/marketing/src/patterns/LegalDocument.stories.tsx`
- 문서: `packages/marketing/README.md` · `apps/sample/src/routes/LegalPage.tsx`
- 쓰지 않는 경우: 법적 효력이 있는 본문이 아니다 — 템플릿이고 법률 검토 후 사실 · 본문을 채워야 공개된다(못 채운 키는 노란 표시로 남는다)
- 키워드: 약관, 이용약관, 개인정보처리방침, 법적 문서, 방침 / terms of service, privacy policy, legal document, tos

### `cookie-consent` — 쿠키 · 추적 동의 — 동의 저장소(버전이 바뀌면 다시 묻기 · 필수 범주는 못 끈다)와 배너(모두 거부 = 모두 허용과 같은 무게).

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/marketing` (`packages/marketing/src/consent/ConsentBanner.stories.tsx`)
- 켜는 법: `--packages marketing` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` 로도 따라온다
- 필요한 것: `marketing`
- 백엔드: 없음(프런트만)
- 주요 진입점: `createConsentStore` · `ConsentBanner` · `useConsent`
- 보고 따라 할 스토리: `packages/marketing/src/consent/ConsentBanner.stories.tsx`
- 문서: `packages/marketing/README.md`
- 쓰지 않는 경우: 추적 · 분석 코드는 없다 — 동의 상태만 저장하고 분석 스크립트는 프로젝트가 동의에 따라 붙인다
- 키워드: 쿠키 동의, 동의 배너, 개인정보 동의, GDPR / cookie consent, consent banner, gdpr, privacy consent

### `error-pages` — 없는 주소(404) · 서버 오류(500, 참조 번호) · 점검 화면 — 이유를 말하고 갈 곳을 준다.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/marketing` (`packages/marketing/src/patterns/NotFound.stories.tsx`)
- 켜는 법: `--packages marketing` — 함께 따라오는 패키지 `api-client` · `auth` · `legal` · `theme` · `time` · `tokens` · `ui` — `--with-sample` 로도 따라온다
- 필요한 것: `marketing`
- 백엔드: 없음(프런트만)
- 주요 진입점: `NotFoundPage` · `ServerErrorPage` · `MaintenancePage` · `StatusPage`
- 보고 따라 할 스토리: `packages/marketing/src/status/StatusPage.stories.tsx`
- 복사해 시작할 Patterns: `packages/marketing/src/patterns/NotFound.stories.tsx`
- 문서: `packages/marketing/README.md`
- 쓰지 않는 경우: SPA 에서는 HTTP 404 상태 코드를 못 낸다 — 상태 코드가 필요하면 서버 렌더 앱 / 로그인 필요 · 권한 없음(403)은 Patterns/Forbidden(@skeleton/ui)
- 키워드: 404, 오류 페이지, 점검 페이지, 500 에러, 없는 페이지 / 404 page, error page, maintenance page, 500 error, not found

### `screen-patterns` — 제품 화면 틀 — 대시보드 · 목록 · 폼 · 상세 · 로그인 · 권한 없음 · 설정을 Patterns/… 스토리에서 복사해 문구 · 데이터 연결만 바꿔 시작한다.

- 종류 · 상태: pattern · stable
- 위치: `@skeleton/ui` (`apps/storybook/src/patterns/ListPage.stories.tsx`)
- 켜는 법: 모든 프로젝트에 들어간다
- 필요한 것: `ui`
- 백엔드: 없음(프런트만)
- 주요 진입점: `PageHeader` · `Table` · `Pagination` · `EmptyState` · `Field` · `Input` · `Tabs` · `ConfirmDialog` · `Stat`
- 복사해 시작할 Patterns: `apps/storybook/src/patterns/DashboardPage.stories.tsx` · `apps/storybook/src/patterns/ListPage.stories.tsx` · `apps/storybook/src/patterns/FormPage.stories.tsx` · `apps/storybook/src/patterns/DetailPage.stories.tsx` · `apps/storybook/src/patterns/LoginPage.stories.tsx` · `apps/storybook/src/patterns/ForbiddenPage.stories.tsx` · `apps/storybook/src/patterns/SettingsPage.stories.tsx`
- 문서: `docs/ui-catalog.md` · `CLAUDE.md`
- 쓰지 않는 경우: 처음부터 짜지 않는다 — 가장 가까운 Pattern 을 복사한다 / 숨은 도우미 파일이 없다 — 한 파일짜리라 복사한 뒤 데이터 훅(TanStack Query)을 잇는 일은 손으로
- 키워드: 대시보드, 목록 화면, 폼 화면, 상세 화면, 설정 화면, 관리자 화면, 화면 틀, 어드민 / dashboard, list page, form page, detail page, settings page, admin screen, screen template

### `script-new-project` — 새 프로젝트 한 줄 찍기 — 이 레포를 복사해 고른 패키지 · 앱만 남기고 이름 · 스코프를 바꾸고 문서와 이 카탈로그를 걸러 다시 쓴다.

- 종류 · 상태: script · stable
- 위치: (`scripts/new-project.sh`)
- 켜는 법: 찍은 프로젝트에는 따라가지 않는다(스켈레톤 도구)
- 백엔드: 없음(프런트만)
- 주요 진입점: `scripts/new-project.sh` · `scripts/new-project.d/stamp.mjs`
- 문서: `docs/new-project-recipe.md` · `CLAUDE.md`
- 쓰지 않는 경우: 찍은 프로젝트에는 따라가지 않는다(스켈레톤 도구) / 기존 프로젝트에 패키지를 더하는 도구가 아니다 — packages/<이름> 폴더를 복사하고 앱 package.json 에 한 줄
- 키워드: 새 프로젝트, 프로젝트 만들기, 찍어내기, 스캐폴딩, 프로젝트 시작 / new project, scaffold, stamp, template, project generator

### `script-test-new-project` — new-project.sh 의 테스트 — 빠른 검사와 --full(여러 조합과 레시피의 예제 명령을 정말 찍어 install · lint · typecheck · test · build).

- 종류 · 상태: script · stable
- 위치: (`scripts/test-new-project.sh`)
- 켜는 법: 찍은 프로젝트에는 따라가지 않는다(스켈레톤 도구)
- 백엔드: 없음(프런트만)
- 주요 진입점: `scripts/test-new-project.sh`
- 문서: `CLAUDE.md`
- 쓰지 않는 경우: 찍은 프로젝트에는 따라가지 않는다 · --full 은 네트워크와 수 분이 든다
- 키워드: 찍기 테스트, 조합 검증, 스캐폴딩 테스트 / stamp test, combination test, scaffold test

### `script-with-watchdog` — 0% CPU 로 멈추는 빌드 · 테스트(rolldown 교착)를 시간으로 끊고 다시 돌리는 감시자 — 명령 앞에 붙인다.

- 종류 · 상태: script · stable
- 위치: (`scripts/with-watchdog.mjs`)
- 켜는 법: 모든 프로젝트에 들어간다
- 백엔드: 없음(프런트만)
- 주요 진입점: `scripts/with-watchdog.mjs`
- 문서: `README.md`
- 쓰지 않는 경우: 진짜 실패(종료 코드 ≠ 0)는 재시도하지 않고 그대로 낸다 — 멈춤만 다룬다
- 키워드: 빌드 멈춤, 워치독, 교착, 멈춘 테스트 재시도 / watchdog, hang, stall, retry build, timeout

### `script-build-capabilities` — capabilities.json 에서 docs/capabilities.md · llms.txt 를 생성하고(--check 로 어긋남 검사) 같은 가드를 돌린다.

- 종류 · 상태: script · stable
- 위치: (`scripts/build-capabilities.mjs`)
- 켜는 법: 모든 프로젝트에 들어간다
- 백엔드: 없음(프런트만)
- 주요 진입점: `scripts/build-capabilities.mjs` · `scripts/capabilities.d/lib.mjs`
- 문서: `docs/capabilities.schema.json`
- 쓰지 않는 경우: 생성물(docs/capabilities.md · llms.txt)을 손으로 고치지 않는다 — capabilities.json 을 고치고 pnpm capabilities
- 키워드: 기능 카탈로그, 카탈로그 생성, 카탈로그 점검, 기능 목록 / capabilities catalog, generate docs, catalog check, feature list
