# 한 서버에 프로젝트 여럿 (프런트)

백엔드(kotlin-skeleton) 프로세스 하나가 요청 **Host**(포트를 뗀 소문자)로 프로젝트를 고른다(`skeleton.projects`). 프런트는 그 Host 가 백엔드까지 그대로 가게 하고, 프로젝트마다 화면 번들을 따로 낸다. **프로젝트 설정이 없으면 지금과 완전히 같다** — 아래 어느 것도 기본 흐름(`pnpm dev` · `pnpm build` · `pnpm start`)을 바꾸지 않는다.

| 하는 일                             | 어디서                                               | 쓰는 앱       |
| ----------------------------------- | ---------------------------------------------------- | ------------- |
| 개발: 같은 앱을 주소만 달리해 여럿  | `apps/sample/README.md` 「한 서버에 프로젝트 여럿…」 | `sample`      |
| 정적 배포: 프로젝트마다 빌드        | 아래 「프로젝트별 정적 빌드 · Pages」                | `sample`      |
| 서버 렌더: 서버 하나가 Host 로 고름 | 아래 「서버 렌더 서버 하나, 프로젝트 여럿」          | `starter-ssr` |

## 개발 — `<이름>.localhost`

`apps/sample/devProxy.ts`: Vite 의 `/api/v1` 프록시가 브라우저가 쓴 Host(`a.localhost:5174`)를 **그대로** 백엔드에 넘기고 `X-Forwarded-Host` 도 단다. `localhost` · `127.0.0.1` · 터널 도메인은 예전 그대로(백엔드가 자기 주소를 본다). 실행은 `apps/sample/README.md`.

## 프로젝트별 정적 빌드 · Pages

프로젝트 하나 = Vite **모드** 하나. `vite build --mode a` 는 `.env.a` 를 읽고(Vite 기본 기능) `--outDir` 로 산출물을 따로 낸다. 프로젝트마다 다른 값은 `.env.<프로젝트>`(또는 `.env.<프로젝트>.local`)에만 둔다(비밀이 아닌 공개 값 — 커밋해도 된다). 모두의 `.env` · `.env.local` 에는 프로젝트 값을 두지 않는다 — 프로젝트 빌드의 검사는 그 파일들을 값의 출처로 치지 않는다.

```bash
# apps/sample/.env.a
VITE_API_BASE_URL=https://api.a.example.com/api/v1   # 필수 — 이 프로젝트의 백엔드 주소(절대 주소)
VITE_SITE_URL=https://a.example.com                  # sitemap.xml · robots.txt 의 바탕

pnpm --filter sample build --mode a --outDir dist/a     # → apps/sample/dist/a  (b 도 같은 식: dist/b)
```

- **API 주소가 프로젝트의 도메인 기준이다.** Pages 에는 `/api/v1` 이 없어서 상대 주소(`/api/v1`, 기본값)로는 호출이 갈 곳이 없다 — 프로젝트 빌드는 `VITE_API_BASE_URL` 이 **`.env.<프로젝트>` 나 명시한 빌드 환경**(셸 · Pages 대시보드)에 `https://` 공개 주소로 있어야 하고, 없거나 `http` · `localhost` 면 **멈춘다**(`apps/sample/projectBuild.ts`). `.env.b` 없이 `--mode b` 를 돌리면 공용 `.env` 의 `localhost:8080` 으로 조용히 통과하지 않는다. sitemap 의 `VITE_SITE_URL` 도 같은 출처만 쓴다. 기본 빌드(`--mode` 없음)는 그대로다.
- 백엔드 쪽: 그 API 도메인(`api.a.example.com`)이 `skeleton.projects.a.hosts` 에 있어야 프로젝트가 정해지고, 프로젝트 `config` 의 CORS 허용 출처에 `https://a.example.com` 이 있어야 브라우저가 부를 수 있다. 쿠키 로그인을 쓰면 SameSite · 도메인도 같이 본다.
- 모드 이름은 소문자 · 숫자 · 하이픈(폴더 이름 · 도메인 라벨로 쓰인다). `production` · `development` · `test` 는 기본 모드라 프로젝트가 아니다.

**Cloudflare Pages(프로젝트별로 하나씩)** — 아래를 대시보드에 적는다. _이 레포는 배포하지 않는다._

| 칸                     | 값                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Root directory         | 레포 루트 (pnpm 워크스페이스가 필요하다)                                                                 |
| Build command          | `pnpm install --frozen-lockfile && pnpm --filter sample build --mode a --outDir dist/a`                  |
| Build output directory | `apps/sample/dist/a`                                                                                     |
| Environment variables  | `.env.a` 대신 여기에 적어도 된다(`VITE_API_BASE_URL` · `VITE_SITE_URL`). 환경변수가 `.env.a` 보다 앞선다 |
| Custom domain          | `a.example.com`                                                                                          |

CLI 로 올린다면(계정 작업이라 여기서는 하지 않았다): `pnpm dlx wrangler pages deploy apps/sample/dist/a --project-name a`. SPA 라우트는 Pages 가 `index.html` 로 되돌려 준다(`404.html` 이 없을 때).

## 서버 렌더 서버 하나, 프로젝트 여럿

`apps/starter-ssr` 의 Node 서버 하나가 요청 Host 로 프로젝트를 고르고, 그 프로젝트의 서버 번들로 그린다. **`PROJECTS_FILE` 이 없으면 지금과 같다**(앱 하나, `dist/client` · `dist/server`).

```bash
# 프로젝트마다 번들을 따로 낸다 — 모드 = 프로젝트 이름 → dist/a/client · dist/a/server
# sitemap.xml · robots.txt 의 공개 주소는 apps/starter-ssr/.env.a 의 SITE_URL 한 줄에서만 온다(셸의 SITE_URL 은 무시, 없으면 robots.txt 만)
pnpm --filter starter-ssr build:project a
pnpm --filter starter-ssr build:project b

# projects.json
{ "projects": {
    "a": { "hosts": ["a.localhost", "a.example.com"], "distDir": "dist/a", "apiBaseUrl": "http://localhost:8080/api/v1", "siteUrl": "https://a.example.com" },
    "b": { "hosts": ["b.localhost", "b.example.com"], "distDir": "dist/b", "apiBaseUrl": "http://localhost:8080/api/v1" }
} }

PROJECTS_FILE=./projects.json pnpm --filter starter-ssr start     # distDir 은 이 파일이 있는 폴더 기준
```

| 지키는 것                    | 어떻게                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host 로 고르기               | `server/projects.ts` — 포트를 떼고 소문자로. 목록에 없는 Host(없는 헤더 포함)는 **421**, 백엔드를 부르지 않는다. **`/healthz` 만 Host 를 보지 않고 200** — 플랫폼 헬스체크(컨테이너 안에서 `wget http://localhost:<port>/healthz`)는 이 경로로 건다(`localhost` 를 어느 프로젝트에 넣지 않는다). 같은 Host 를 두 프로젝트가 쓰거나 이름 · Host 모양이 틀리면 기동이 실패한다. 응답에 `Vary: Host`                                                                                                                                                                                                                                                                                                                                                                                     |
| 프로젝트 사이 상태 누출 없음 | 프로젝트마다 서버 번들(모듈 인스턴스) · 템플릿 · 렌더러 · 정적 폴더가 따로다. 번들은 의존을 안에 담아(`ssr.noExternal`) `@skeleton/*` 의 모듈 전역도 프로젝트마다 따로다. 요청마다 새 `QueryClient` · 세션. 루트 `tests/ssr.safety.test.ts` 가 표식이 든 입력(로그인한 세션)으로 한 번 그린 뒤, 같은 번들의 다음 요청과 독립된 다른 번들이 평범한 입력 그대로 그려지는지(표식 없이) 잰다 — 순차 요청만 잰다, 겹친 요청은 요청마다 새로 만드는 구조가 막는다                                                                                                                                                                                                                                                                                                                           |
| 캐시 키                      | 서버 안에 응답 · 데이터 캐시가 없다(프로젝트마다 핸들러가 따로 가진 템플릿뿐). 앞단 캐시(Caddy · CDN)는 `Vary: Host` 를 따르거나 키에 Host 를 넣는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 백엔드에 원래 Host           | 렌더가 백엔드를 부를 때 방문자의 Host(포트 포함, `a.localhost:3000`)를 모든 호출(공개 `skipAuth` 호출 포함)에 `X-Forwarded-Host` 로 단다. `Host` 는 건드리지 않는다 — `apiBaseUrl` 이 https · 프록시 뒤여도 길이 그대로다. 백엔드는 ForwardedHeaderFilter 뒤에서 이 값으로 프로젝트를 고른다. **`apiBaseUrl` 은 프로젝트마다 필수**(전역 `API_BASE_URL` 로 대신하지 않는다 — 비워 두면 목록 파일 읽기에서 기동이 실패한다)이고, 프록시를 거치지 않고 백엔드로 바로 가는 내부 주소(예 `http://api:8080/api/v1`)여야 한다. 사이에 프록시(Caddy 등)가 있으면 그 프록시가 `X-Forwarded-Host` 를 자기가 받은 Host 로 다시 써서 다른 프로젝트 데이터가 그려질 수 있다 — 그 프록시가 이 SSR 서버를 신뢰 프록시로 두고 전달된 값을 그대로 넘기게 해야 한다(요청마다 클라이언트를 새로 만든다) |
| `siteUrl`                    | 프로젝트의 `siteUrl`(canonical · og:url)은 목록의 그 프로젝트 값뿐이다. 없으면 태그를 뺀다 — 전역 `SITE_URL` 로 대신하지 않는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/assets` 는 Host 별         | 정적 파일은 그 프로젝트의 `distDir/client` 에서만. 다른 프로젝트의 해시 파일은 404                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 분리                         | 목록에 그 프로젝트만 남기면 그대로 혼자 뜬다(다른 프로젝트의 Host 는 421). `dist/<프로젝트>` 는 `node_modules` 없이 도는 폴더 하나라 서버 파일(`server/`)과 함께 옮기면 된다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

개발 서버(`pnpm dev:ssr`)는 프로젝트 하나짜리 그대로다 — `PROJECTS_FILE` 과 함께 `--dev` 로 띄우면 일부러 멈춘다(프로젝트마다 번들을 분리하려면 빌드한 서버가 필요하다). Docker 이미지(`Dockerfile`)는 아직 기본 `build` 한 벌만 낸다.

**백엔드가 맞출 것**: Host(포트 뺀 소문자) 로 프로젝트를 고른다 — 개발 프록시(`*.localhost`, http 로컬)는 `Host` 와 `X-Forwarded-Host` 를, SSR 서버는 `X-Forwarded-Host` 만 방문자의 값으로 단다(SSR 은 `Host` 를 그대로 둔다). 목록에 `a.localhost` 같은 개발 Host 가 있어야 한다.
