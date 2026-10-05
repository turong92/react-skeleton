# starter-ssr

서버가 **첫 응답을 그려 보내고** 브라우저가 그 위에 이어받는(하이드레이션) 스타터. 페이지는 `apps/starter` 와 같다 — 홈(`GET /api/v1/hello` 예시) · 로그인 · 보호된 `/account` · 404 — 같은 패키지(`@skeleton/*`)로 만들었다. 새 프로젝트는 `scripts/new-project.sh --ssr` 로 이것을 앱으로 찍는다.

**SPA 스타터(`apps/starter`)와 무엇이 다른가 / 언제 이것을 고르나**

|         | `apps/starter` (SPA)                | `apps/starter-ssr` (이 앱)                                                                |
| ------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| 첫 응답 | 빈 `<div id="root">` + 스크립트     | 그려진 HTML(내용 · `<title>` · 설명 · 데이터)                                             |
| 호스팅  | 정적 파일(Caddy · Pages)            | Node 프로세스 1개(Dockerfile 있음) + 백엔드                                               |
| 고를 때 | 로그인 뒤 앱 · 대시보드 · 내부 도구 | 검색 노출(SEO) · 링크 미리보기(OG) · 첫 화면이 빨라야 하는 공개 페이지                    |
| 비용    | 낮다                                | 서버 운영 · 렌더 규칙(아래 「규칙」) · 느린 백엔드가 첫 응답을 늦춘다(시간 제한이 막는다) |

기본은 SPA 다. 실제로 검색 · 미리보기 · 첫 화면이 필요한 앱만 이것으로 시작한다(Next.js 같은 프레임워크 대신 **plain Vite SSR** 를 골랐다 — 새 런타임 의존이 없고, 코드가 짧아 읽히고, 이 스켈레톤의 패키지 · 라우터 · 쿼리를 그대로 쓴다).

## 실행

```bash
pnpm --filter starter-ssr dev        # 개발 — http://localhost:3000 (Vite 미들웨어: HMR · /api/v1 → :8080 프록시, 요청마다 서버 번들을 다시 읽는다)
pnpm --filter starter-ssr build      # dist/client(브라우저) + dist/server(서버 번들 — 의존을 안에 담는다)
pnpm --filter starter-ssr start      # 프로덕션 — node server/main.ts, dist 를 낸다. node_modules 가 필요 없다

docker build -f apps/starter-ssr/Dockerfile -t starter-ssr .      # 컨텍스트는 레포 루트
docker run --rm -p 3000:3000 -e API_BASE_URL=http://host.docker.internal:8080/api/v1 starter-ssr
```

루트에서는 `pnpm dev:ssr`. Node 24(또는 22.18+ — `server/*.ts` 를 타입 제거로 직접 읽는다).

| 환경변수             | 기본                           | 뜻                                                                                   |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `HOST` · `PORT`      | `127.0.0.1` · `3000`           | 듣는 주소(컨테이너는 `0.0.0.0`). `PORT=0` 은 빈 포트                                 |
| `API_BASE_URL`       | `http://localhost:8080/api/v1` | **서버 렌더가** 첫 데이터를 가져오는 백엔드(절대 주소)                               |
| `SSR_API_TIMEOUT_MS` | `2000`                         | 서버 렌더 중 백엔드를 기다리는 최대 시간                                             |
| `DIST_DIR`           | `./dist`                       | `vite build` 결과 폴더                                                               |
| `VITE_API_*`         | —                              | **브라우저의** API 클라이언트(`apps/starter` 와 같다). 기본 같은 origin 의 `/api/v1` |

브라우저는 같은 origin 의 `/api/v1` 을 부른다 — 프로덕션에서는 앞단(Caddy)이 `/api/v1` → 백엔드, 나머지 → 이 서버로 합친다(CORS 없음). 이 서버는 `/api/v1` 을 프록시하지 않는다(개발은 Vite 가 한다).

## 요청 한 번이 지나가는 길

```
GET /            server/main.ts ─ createHandler(server/handler.ts)
                   ├ 파일이면(dist/client: /assets/* · favicon) → 그 파일(해시 파일은 immutable 캐시, 없으면 진짜 404)
                   └ 아니면 render(url) = src/entry-server.tsx
                        1. 라우트 맞추기 → 없으면 status 404 (그 외 200)
                        2. 맞은 라우트의 handle.prefetch 로 첫 데이터(홈: GET /hello) — 시간 제한 · 실패해도 계속
                        3. renderToString(<AppProviders><StaticRouter><AppRoutes/>…)  ← 요청마다 새 QueryClient · 세션
                        4. head = <title> · 설명 · (noindex) · dehydrate 한 쿼리 캐시(<script type="application/json">)
                   템플릿(dist/client/index.html — <head> 맨 앞에 테마 스크립트)의 자리표시자에 채워 status 와 함께 응답
브라우저          src/entry-client.tsx: initTheme() → 상태 읽기 → hydrate(queryClient) → hydrateRoot(…createClientApp…)
```

| 파일                                                   | 하는 일                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `server/main.ts`                                       | 개발(Vite 미들웨어) · 프로덕션(`dist`) 서버, 종료 신호 처리                                |
| `server/handler.ts`                                    | 정적 파일 · 렌더 응답 · 상태 코드 · `HEAD` · 405 · 400 · 500(오류 글자를 내보내지 않는다)  |
| `server/config.ts`                                     | 환경변수 → 설정(못 쓰는 값은 던진다)                                                       |
| `src/entry-server.tsx`                                 | `render(url, { api })`(테스트는 가짜 어댑터를 넘긴다) · `createRenderer(config)`           |
| `src/entry-client.tsx` · `src/app/createClientApp.tsx` | 하이드레이션 · 브라우저 쪽 트리(서버와 같은 `AppProviders` · `AppRoutes`, 라우터만 다르다) |
| `src/routes/routes.tsx`                                | path → page. 라우트마다 `handle`: **제목 · 설명**(필수) · `robots` · `prefetch`(첫 데이터) |
| `src/ssr/head.ts`                                      | `<title>` · 설명 · 상태 스크립트(`</script>` 로 빠져나올 수 없게 직렬화)                   |
| `src/api/` · `src/hooks/useHello.ts`                   | 요청마다 / 앱마다 만든 클라이언트를 컨텍스트로(`useApi`) — 모듈 전역 없음                  |
| `Dockerfile`                                           | 빌드 → 런타임(`node_modules` 없이 `dist` + `server`)                                       |

## 첫 데이터와 하이드레이션

- 홈은 서버에서 `GET {API_BASE_URL}/hello` 를 부르고(`createServerApiClient`: 토큰 없음 · 재시도 없음 · `SSR_API_TIMEOUT_MS`), 결과를 HTML 에 그린 뒤 TanStack Query 의 `dehydrate` 결과를 `<script type="application/json" id="__SSR_STATE__">` 로 보낸다. 브라우저는 `hydrate(queryClient, state)` 한 뒤 그리므로 **첫 그림부터 데이터가 있다**(스피너 깜빡임 없음). `staleTime` 30초라 하이드레이션 직후에 같은 요청을 또 하지 않는다.
- **백엔드가 죽었거나 느리면** 서버는 데이터 없이 그린다 — 200 + 「불러오는 중」 스피너(캐시는 비어 있다). 브라우저가 이어받자마자 다시 부르고, 그래도 실패하면 오류 토스트와 안내가 뜬다. 서버 렌더는 `prefetchQuery` 가 던지지 않고 시간 제한이 걸려 있어 응답이 멈추지 않는다.
- 새 페이지의 데이터: `hooks/useHello.ts` 모양(쿼리 정의 + 훅)을 복사하고, 라우트의 `handle.prefetch` 에 `queryClient.prefetchQuery(xxxQuery(api))` 를 적는다. **토큰 없이 읽는 공개 데이터만** 서버에서 미리 가져올 수 있다.

## 테마 — 깜빡임 없음

`@skeleton/theme/vite` 의 `themePrePaint()` 가 저장한 테마를 읽어 `<html data-theme>` 에 다는 인라인 스크립트를 `<head>` 맨 앞에 넣는다(빌드한 `index.html` 에 들어 있다) — 첫 칠 전에 달리므로 어두운 테마가 흰 화면으로 번쩍이지 않는다. 브라우저 진입점은 그 뒤 `initTheme()`(`@skeleton/theme` 는 불러올 때 아무것도 하지 않는다)를 부른다. 서버는 저장한 선택을 모르므로 토글 아이콘은 서버 HTML 과 하이드레이션 첫 그림에서 `system`, 이어받은 뒤 저장한 값으로 바뀐다(`getServerSnapshot`).

## 인증 — 토큰은 브라우저에만 있다

토큰은 `sessionStorage`(앱의 `auth/storage.ts` — `apps/starter` 와 같다)에 있고 서버로 보내지 않는다. 그래서 **서버는 로그인 여부를 모른다.**

- 서버 렌더와 하이드레이션 첫 그림은 항상 「로그인 안 한」 상태다(`createDeferredTokens`: 저장소를 **생성할 때 읽지 않고** 하이드레이션 뒤 `AuthRoot` 의 effect 가 `restore()` 로 올린다). 읽는 순간 헤더의 로그아웃 버튼이 달라져 서버 HTML 과 어긋난다 — `src/hydration.test.tsx` 의 대조 검사가 그 경우를 일부러 재현해, 검사가 실제로 실패할 수 있음을 보인다.
- 보호된 `/account` 는 `ClientRequireAuth` 아래에 있다. 복원이 끝나기 전에는 **중립 자리 표시(스피너 `확인 중`)만** 그린다 — 보호된 내용도 `/login` 이동도 없다. 서버 응답은 200(+ `noindex`). 복원이 끝나면 `RequireAuth` 와 똑같이 동작한다(로그인 안 했으면 `/login` 으로, 돌아올 위치를 기억한다).
- **쿠키 기반으로 바꾸려면**(HttpOnly 세션 쿠키 — 첫 응답부터 로그인한 모습을 그리고 싶을 때): ① 백엔드가 로그인에 `Set-Cookie`(HttpOnly · Secure · SameSite)를 내고 `GET /auth/me` 가 쿠키를 읽는다 ② 서버가 요청의 `Cookie` 헤더를 백엔드 호출에 그대로 넘긴다(`createServerApiClient` 에 요청별 헤더) — 그러면 서버 클라이언트는 **요청마다** 만들어야 하고 응답에 `Cache-Control: private` 를 단다 ③ `entry-server` 가 `me` 를 prefetch 해 `AuthProvider` 의 초기 상태로 내리고 `ClientRequireAuth` 를 `RequireAuth` 로 되돌리며, 보호 라우트가 로그인 안 한 요청에는 서버가 302 를 낸다 ④ 쿠키를 쓰면 CSRF 방어(SameSite · 토큰)가 필요하다. 이 스타터는 그 비용을 지지 않으려고 토큰을 브라우저에 둔다.

## 상태 코드 · 문서 정보

- 맞는 라우트 200, 없는 주소 **404**(HTML 은 404 페이지, `noindex`), 없는 `/assets/*` 는 평범한 404(HTML 이 스크립트 자리에 들어가지 않게), `POST` 등은 405, 깨진 주소 400, 렌더가 던지면 500(글자만).
- `<html lang>`(템플릿의 `ko`), `<title>`(`<페이지> · <앱 이름>`), `<meta name="description">` 는 라우트의 `handle` 에서 온다. 브라우저에서 라우트를 옮길 때도 `useRouteMeta` 가 같은 값으로 맞춘다. 앱 이름은 `src/appName.ts` 한 줄.

## 규칙 — 서버에서 그려도 깨지지 않으려면

1. 렌더 중에는 `window` · `document` · `localStorage` 를 읽지 않는다 — effect · 이벤트 핸들러 안에서만. 모든 `@skeleton/*` 패키지가 이 규칙을 지키는지는 루트 `tests/ssr.safety.test.ts` 가 재고(서버에서 모든 컴포넌트 · 훅을 그린다), `@skeleton/theme` 도 불러올 때 아무것도 하지 않는다.
2. **서버 HTML 과 브라우저 첫 그림이 같아야 한다.** 시각 · 난수 · 브라우저 시간대 · 로케일에 따라 달라지는 글자(`formatInstant(iso)` 기본값, `new Date()`, `Math.random()`)는 서버(UTC · en-US)와 사용자(Asia/Seoul · ko-KR)에서 다르다 — 하이드레이션 뒤(effect)에 그리거나, 시간대 · 로케일을 명시(`formatInstant(iso, { zone: 'Asia/Seoul', locale: 'ko-KR' })`)하거나, 시각이 필요 없는 마크업이 되게 한다. 알림 목록(`NotificationList`)처럼 시각을 그리는 부품은 로그인 뒤 화면에서만 쓴다(서버에서 그리지 않는 곳).
3. 모듈 전역 클라이언트 · 세션 · 캐시 금지 — 서버에서 요청 사이에 섞인다. `useApi()` · `createClientApp` 처럼 만들어 내려준다.
4. 서버에서 부를 데이터는 토큰 없이 읽는 공개 데이터만.
5. 스트리밍(`renderToPipeableStream` · Suspense)은 쓰지 않는다 — 첫 데이터를 시간 제한 안에 기다린 뒤 `renderToString` 한다. 상태 코드가 본문보다 먼저 정해져야 하고(404), 데이터가 작고 빠르다는 가정이다. 느린 데이터가 많아지면 그때 스트리밍으로 옮긴다(`entry-server.tsx` 의 `render` 만 바뀐다).

## 테스트

`pnpm --filter starter-ssr test`

| 테스트                              | 무엇을 보장하나                                                                                                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/entry-server.test.tsx`         | `/` · `/account` · 없는 주소 · `/login` 을 가짜 백엔드로 렌더 — HTML 내용 · dehydrate 한 상태 · 상태 코드 · 제목 · robots · 백엔드 죽음 / 무응답 / `</script>` 주입                                                                                                   |
| `src/hydration.test.tsx`            | 서버 HTML == 브라우저 진입점 트리의 첫 그림(저장소에 토큰이 있고, 서버 상태를 이어받은 채) — 네 라우트. 순진한 구현이 실제로 어긋남도 재현                                                                                                                            |
| `server/handler.test.ts`            | 정적 파일 · 캐시 · 상태 코드 · `$&` 안전 · 폴더 밖 경로 거부 · 500                                                                                                                                                                                                    |
| `server/server.integration.test.ts` | `vite build`(임시 폴더) → **node_modules 없는 곳에서** `node server/main.ts` 를 빈 포트로 → JS 없는 HTTP 클라이언트로 요청: 내용이 HTML 에 있는가 · 자산이 풀리는가 · 404 · 백엔드 무응답 / 연결 거부 · SIGTERM. 모든 대기에 시간 제한, 끝나면 자식 프로세스를 죽인다 |

DOM 라이브러리가 없어 하이드레이션 자체는 위 「같은 마크업」으로 잰다. **눈으로 확인**: 빌드한 서버를 띄워 `curl http://127.0.0.1:3000/` 로 HTML 에 내용이 있는지, 브라우저에서 JS 를 켜고 콘솔에 하이드레이션 경고(`Minified React error #418/#423/#425`)가 없는지 본다.
