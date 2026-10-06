# 새 프로젝트 레시피 — 제품 한 문단에서 돌아가는 프로젝트까지

에이전트가 「X, Y, Z 가 필요한 새 프로젝트를 세팅해」를 받았을 때 **그대로 따라 하는** 순서다. 먼저 이미 있는 것을 찾고(만들지 않는다), 두 레포의 `new-project.sh` 를 한 번씩 돌린 뒤, 화면마다 복사할 Pattern 을 정한다.
명령 조각은 `capabilities.json` 에서 계산한 것이고, 아래 작업 예의 명령은 테스트가 같은 계산과 비교하고 `bash scripts/test-new-project.sh --full` 이 실제로 찍어 본다 — 이 문서가 낡으면 빌드가 실패한다.

## 0. 놓는 곳

```
~/work/<이름>/
├── api/   # kotlin-skeleton 에서 찍은 백엔드
└── web/   # react-skeleton 에서 찍은 프런트(이 레포)
```

두 스켈레톤 레포(`react-skeleton` · `kotlin-skeleton`)는 형제 폴더로 이미 있다. 명령은 각 스켈레톤 레포 루트에서 돌린다.

## 1. 제품 한 문단 → 필요한 것

1. 제품 설명에서 기능 말(로그인 · 게시판 · 댓글 · 결제 · 다국어 · 랜딩 · 약관 · 알림 · 파일 업로드 …)을 뽑는다.
2. `docs/capabilities.md` 의 「필요한 것 → 고를 것」 표에서 그 말을 찾는다. 없으면 같은 문서의 「전체 목록」 키워드 열(한국어 / 영어)을 훑거나 `capabilities.json` 의 `keywords` 를 검색한다.
3. 고른 항목의 `id` 를 모은다. `needs` 는 따라오는 것이라 따로 적지 않는다(패키지는 `new-project.sh` 가 의존으로 닫는다 · 패턴은 계산 때 함께 켜진다).
4. 항목의 `notFor` 를 읽는다 — 이 제품에 안 맞으면 다른 항목이다.
5. **카탈로그에 없는 것은 만들기 전에** `docs/ui-catalog.md`(부품 · Patterns)에 있는지 본다. 그래도 없을 때만 새로 만든다.

## 2. 명령 만들기

- react: `scripts/new-project.sh <target-dir> <name> [--packages a,b,c] [--ssr] [--without-storybook] [--with-workbench] [--with-sample] [--scope @acme]`
- kotlin: `scripts/new-project.sh <target-dir> <root-package> <config-prefix> <ClassPrefix> [--modules a,b,c] [--db postgresql|mysql] [--with-workbench] [--with-sample]`

결정표의 조각을 합친다: `--packages` 는 하나로(쉼표) 합치고 다른 옵션은 그대로 덧붙인다. 소셜 로그인 제공자(`auth-social-google` | `-kakao` | `-naver`)와 실시간 전달(`notification-sse` | `notification-websocket`)은 하나 이상 고른다 — 아래 예는 첫 번째를 쓴다.

## 3. 채울 설정

| 어디   | 무엇                                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 백엔드 | `skeleton.auth-social.providers.<제공자>` 의 `enabled` · `client-id` · `client-secret` · `redirect-uri`(소셜), `skeleton.board.seed-boards` · `reaction.types`(게시판), `skeleton.payment-toss` 의 `enabled` · `secret-key`(결제), 운영 프로필의 `JWT_SECRET`. 모듈마다 `docs/config/modules/<모듈>.yml`(kotlin-skeleton) |
| 프런트 | 앱 폴더 `.env`(`.env.example` 를 복사): `VITE_API_BASE_URL`(비우면 Vite 가 `/api/v1` 을 :8080 으로 프록시) · `VITE_SITE_URL`(공개 주소, SEO) · 서버 렌더 앱은 `SITE_URL` · `API_BASE_URL` · 캡차는 `VITE_TURNSTILE_SITE_KEY`, 소셜은 제공자 `clientId`(공개값)                                                            |
| 비밀   | `clientSecret` · 결제 `secret-key` · Turnstile secret 은 **프런트에 두지 않는다**(백엔드 환경변수로)                                                                                                                                                                                                                      |

## 4. 찍은 뒤 처음 한 번

```bash
cd ~/work/<이름>/web
pnpm install --no-frozen-lockfile   # 잠금 파일이 이 워크스페이스에 맞춰진다 — 결과를 커밋한다
pnpm format                         # 이름 · 스코프를 바꾼 줄바꿈 (한 번만)
```

고른 패키지는 **폴더만** 따라온다. 쓰기 시작할 때 앱 `package.json` 에 `"@skeleton/<이름>": "workspace:*"` 한 줄을 더하고 `pnpm install`(스코프를 바꿨으면 그 스코프) — 쓰지 않는 의존을 선언하면 루트 테스트가 막는다.
`CLAUDE.md` · `llms.txt` · `capabilities.json` 이 이미 찍은 프로젝트에 맞게 걸러져 있다 — 새 기능을 만들기 전에 그것부터 읽는다.

## 5. 실행

```bash
cd ~/work/<이름>/api && scripts/dev.sh     # DB(+ 로컬 S3) 컨테이너 → 백엔드 :8080 → 옆의 ../web 의 pnpm dev(:5173)
# 프런트만: cd ~/work/<이름>/web && pnpm dev     # 서버 렌더 앱은 :3000
# 스토리집(백엔드 불필요): pnpm storybook         # :6006
```

로컬 시드 사용자는 `user@example.com` / `password`(백엔드 `dev-login`). 포트가 겹치면 백엔드 `SERVER_PORT` · `DB_PORT`, 프런트 `API_PROXY_TARGET`.

## 6. 화면마다 복사할 Pattern

가장 가까운 Pattern 을 **복사**해 문구와 데이터 연결만 바꾼다(처음부터 짜지 않는다). 부품은 `docs/ui-catalog.md` 의 스토리를 보고 같은 사용법으로 쓴다.

| 화면                      | 복사할 것                                                                                                           | 어느 항목               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 로그인(+ 소셜 버튼)       | `apps/storybook/src/patterns/LoginPage.stories.tsx` + `packages/auth/README.md` 의 소셜 스니펫                      | `auth` · `social-login` |
| 대시보드 · 목록 · 상세    | `apps/storybook/src/patterns/DashboardPage.stories.tsx` · `ListPage.stories.tsx` · `DetailPage.stories.tsx`         | `screen-patterns`       |
| 폼(만들기 · 수정)         | `apps/storybook/src/patterns/FormPage.stories.tsx`                                                                  | `screen-patterns`       |
| 설정 · 권한 없음          | `apps/storybook/src/patterns/SettingsPage.stories.tsx` · `ForbiddenPage.stories.tsx`                                | `screen-patterns`       |
| 게시판 목록 · 글 · 글쓰기 | `apps/sample/src/routes/BoardPage.tsx` · `BoardPostPage.tsx` · `BoardFormPage.tsx` (`--with-sample`)                | `board`                 |
| 랜딩                      | `packages/marketing/src/patterns/Landing.stories.tsx`                                                               | `landing-page`          |
| 요금제                    | `packages/marketing/src/patterns/Pricing.stories.tsx`                                                               | `pricing-page`          |
| 약관 · 방침               | `packages/marketing/src/patterns/LegalDocument.stories.tsx`                                                         | `legal-documents`       |
| 404 · 500 · 점검          | `packages/marketing/src/patterns/NotFound.stories.tsx`                                                              | `error-pages`           |
| 알림 종 · 실시간          | `apps/sample/src/notifications/useLiveNotifications.ts` · `packages/notifications/src/NotificationBell.stories.tsx` | `live-notifications`    |
| 다국어 사전 · 언어 메뉴   | `apps/sample/src/i18n/index.ts` · `packages/ui/src/LanguageMenu/LanguageMenu.stories.tsx`                           | `i18n`                  |

`--with-sample` 로 찍지 않았다면 `apps/sample/…` 파일은 스켈레톤 레포에서 본다(찍힌 프로젝트에는 없다).

## 7. 검증

```bash
# web (프런트)
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm build
pnpm capabilities:check             # 카탈로그가 폴더와 맞는가
pnpm test:stories                   # 처음 한 번: pnpm exec playwright install chromium
# api (백엔드)
./gradlew build                     # Docker 필요(Testcontainers)
```

빌드 · 테스트가 0% CPU 로 멈추면 `node scripts/with-watchdog.mjs -- pnpm build` 처럼 앞에 붙인다.

## 8. 배포

- 백엔드: kotlin-skeleton 레포의 docs/deploy.md(이미지 하나 + 선언 `deploy/app.yaml`, tag 를 올리는 것이 배포).
- 프런트 SPA: `pnpm build` 의 `dist/` 를 Caddy 가 같은 origin 으로 서빙 + 백엔드 프록시(CORS 불필요). 서버 렌더 앱: `apps/starter-ssr/README.md` 와 앱 폴더의 `Dockerfile`.
- 공개 주소는 `VITE_SITE_URL`(서버 렌더 앱은 `SITE_URL`)을 배포 환경에 준다.

## 작업 예

### 예 1. 커뮤니티 사이트 — 소셜 로그인 · 게시판(댓글 · 공감) · 알림 · 다국어 · 랜딩

> 관심사가 같은 사람들이 모이는 커뮤니티. 비로그인 방문자는 랜딩을 보고, 구글 · 카카오로 가입해 글을 쓰고 댓글 · 공감을 주고받으며, 내 글에 댓글이 달리면 알림이 바로 뜬다. 화면은 한국어 · 영어.

고르기: `social-login` `board` `live-notifications` `i18n` `landing-page` `seo` `legal-documents` `cookie-consent`(로그인 `auth` 는 기본 포함). 랜딩 · 약관 · 동의는 `marketing` 하나로 오고, 보고 따라 할 참조로 `--with-sample` 을 더했다(샘플이 board · notifications · realtime · i18n · marketing · seo 를 쓴다).

<!-- react-stamp: community -->

```bash
scripts/new-project.sh ~/work/community/web community --packages board,notifications,realtime,i18n,marketing,seo --with-sample
```

<!-- kotlin-stamp: community -->

```bash
scripts/new-project.sh ~/work/community/api dev.example.community community Community --modules auth-social,auth-social-google,board,board-jdbc,notification,notification-jdbc,notification-sse
```

그다음:

```bash
cd ~/work/community/web && pnpm install --no-frozen-lockfile && pnpm format
# 앱 package.json 에 쓰기 시작할 때 한 줄씩: "@skeleton/board" "@skeleton/notifications" "@skeleton/realtime" "@skeleton/i18n" "@skeleton/marketing" "@skeleton/seo": "workspace:*"
cd ~/work/community/api && scripts/dev.sh
cd ~/work/community/web && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm capabilities:check
```

손으로 써야 하는 것: 소셜은 백엔드의 제공자 설정(로그인 버튼 · `/auth/callback` 은 `GET /auth/methods` 가 알려 준 제공자로 `createAuthRoutes` 가 만든다 — 백엔드가 clientId 를 모르면 `VITE_SOCIAL_<제공자>_CLIENT_ID`, 방법을 고정하려면 `--auth-methods` · `VITE_AUTH_METHODS` — `packages/auth/README.md`), 게시판 코드 · 반응 종류(`skeleton.board.seed-boards` · `reaction.types`), 알림 연결 훅(`apps/sample/src/notifications/useLiveNotifications.ts` 복사), 한/영 사전, 랜딩 문구, 약관 본문(템플릿은 법적 효력이 없다).

### 예 2. 유료 SaaS 대시보드 — 로그인 · 대시보드/목록/설정 · 요금제 · 결제 · 알림

> 월 구독으로 쓰는 업무 도구. 로그인 후 대시보드 · 목록 · 상세 · 설정 화면이 있고, 요금제 페이지에서 플랜을 골라 토스로 결제하며, 가입 폼은 봇을 막고, 결제 · 작업 완료 알림을 받는다.

고르기: `auth`(기본) `screen-patterns`(기본) `pricing-page` `payment` `notifications` `captcha-turnstile`. 패키지 스코프를 `@acme` 로 바꾸고 백엔드는 MySQL 로 둔다.

<!-- react-stamp: saas -->

```bash
scripts/new-project.sh ~/work/saas/web saas --packages marketing,payment,notifications,captcha-turnstile --scope @acme
```

<!-- kotlin-stamp: saas -->

```bash
scripts/new-project.sh ~/work/saas/api dev.example.saas saas Saas --modules payment,payment-toss,notification,notification-jdbc,captcha-turnstile --db mysql
```

그다음:

```bash
cd ~/work/saas/web && pnpm install --no-frozen-lockfile && pnpm format
# 앱 package.json: "@acme/marketing" "@acme/payment" "@acme/notifications" "@acme/captcha-turnstile": "workspace:*"
cd ~/work/saas/api && scripts/dev.sh
cd ~/work/saas/web && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm capabilities:check
```

손으로 써야 하는 것: 토스 결제 위젯과 성공/실패 라우트(`confirmRequestFromTossRedirect`), 주문 · 금액 검증 컨트롤러(백엔드가 HTTP 를 열지 않는다 — `skeleton.payment-toss` 켜기 + `secret-key`), 요금제 데이터, 화면별 데이터 훅(Patterns 복사), 가입 폼의 `<Turnstile>`.

### 예 3. 콘텐츠 · 랜딩 사이트 (서버 렌더링) — 검색에 노출되는 소개 · 요금 · 약관

> 제품 소개 · 요금제 · 약관을 보여 주는 공개 사이트. 검색 결과와 링크 미리보기가 중요해 서버가 첫 HTML 을 그리고, 한국어 · 영어, 쿠키 동의 배너, 404 화면이 있다. 로그인 · 데이터 입력은 없다.

고르기: `app-starter-ssr`(`--ssr` — `seo` 가 따라온다) `landing-page` `pricing-page` `legal-documents` `cookie-consent` `error-pages` `i18n`. 백엔드는 스타터 그대로(모듈을 더하지 않는다).

<!-- react-stamp: content-ssr -->

```bash
scripts/new-project.sh ~/work/site/web site --packages marketing,i18n --ssr
```

<!-- kotlin-stamp: content-ssr -->

```bash
scripts/new-project.sh ~/work/site/api dev.example.site site Site
```

그다음:

```bash
cd ~/work/site/web && pnpm install --no-frozen-lockfile && pnpm format
# 앱 package.json: "@skeleton/marketing" "@skeleton/i18n": "workspace:*"
pnpm dev            # http://localhost:3000 (Node 서버 + Vite)
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm capabilities:check
pnpm --filter site build && pnpm --filter site start   # 프로덕션 서버(dist/) — Dockerfile 은 앱 폴더
```

손으로 써야 하는 것: 라우트마다 `handle`(제목 · 설명 · prefetch), 렌더 중 `window` · `localStorage` 금지, `SITE_URL`, 랜딩 · 요금제 · 약관 문구와 데이터, 한/영 사전, 동의에 따라 붙이는 분석 코드(스켈레톤에는 없다).
