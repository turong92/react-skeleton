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

프로젝트 하나 = Vite **모드** 하나. `vite build --mode a` 는 `.env.a` 를 읽고(Vite 기본 기능) `--outDir` 로 산출물을 따로 낸다. 프로젝트마다 다른 값은 `.env.<프로젝트>` 에만 둔다(비밀이 아닌 공개 값 — 커밋해도 된다).

```bash
# apps/sample/.env.a
VITE_API_BASE_URL=https://api.a.example.com/api/v1   # 필수 — 이 프로젝트의 백엔드 주소(절대 주소)
VITE_SITE_URL=https://a.example.com                  # sitemap.xml · robots.txt 의 바탕

pnpm --filter sample build --mode a --outDir dist/a     # → apps/sample/dist/a  (b 도 같은 식: dist/b)
```

- **API 주소가 프로젝트의 도메인 기준이다.** Pages 에는 `/api/v1` 이 없어서 상대 주소(`/api/v1`, 기본값)로는 호출이 갈 곳이 없다 — `VITE_API_BASE_URL` 이 없거나 상대 주소면 프로젝트 빌드가 **멈춘다**(`apps/sample/projectBuild.ts`). 기본 빌드(`--mode` 없음)는 그대로다.
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
