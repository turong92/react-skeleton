import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { seoFiles } from '@skeleton/seo/vite'
import { themePrePaint } from '@skeleton/theme/vite'
import { apiProxy } from './devProxy.ts'
import { assertProjectBuildEnv, projectOwnEnv } from './projectBuild.ts'

// 백엔드를 다른 주소 · 포트로 띄웠다면: API_PROXY_TARGET=http://localhost:18080 pnpm dev (기본 8080)
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8080'
// 게시판 사진의 공개 주소는 같은 출처의 `/files/...`(백엔드 로컬 설정 skeleton.storage.web.public.base-url=/files) - 로컬 S3(SeaweedFS)의 공개 접두사로 넘긴다.
// 폰이 터널로 열어도 사진이 같은 출처라 깨지지 않는다. S3 를 다른 포트로 띄웠다면 S3_PORT=18333 (docker-compose 와 같은 이름)
const filesTarget =
  process.env.FILES_PROXY_TARGET ?? `http://127.0.0.1:${process.env.S3_PORT ?? '8333'}/app`

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // 프로젝트별 정적 빌드(`vite build --mode a`)는 `.env.a` 를 읽는다 — API 주소가 없으면 멈춘다(projectBuild.ts)
  const own = projectOwnEnv(mode, process.cwd(), process.env)
  assertProjectBuildEnv(mode, command, own)
  return {
    plugins: [
      react(),
      themePrePaint(),
      // 빌드가 sitemap.xml · robots.txt 를 낸다 — 공개 페이지만 적고(랜딩 · 약관 · 방침), 로그인 뒤 화면은 robots 에서 막는다.
      // 공개 주소는 VITE_SITE_URL(.env 또는 빌드 환경변수) — 없으면 robots.txt 만 내고 경고한다
      seoFiles({
        // 프로젝트 빌드는 프로젝트 자신의 공개 주소만 쓴다(공용 .env 의 값으로 다른 프로젝트 주소가 sitemap 에 새지 않게)
        baseUrl:
          (command === 'build' && Object.keys(own).length > 0 ? own : env).VITE_SITE_URL ||
          undefined,
        routes: ['/', '/terms', '/privacy', '/refund'],
        robots: {
          rules: [
            {
              userAgent: '*',
              allow: ['/'],
              disallow: [
                '/login',
                '/sign-up',
                '/verify-email',
                '/forgot-password',
                '/reset-password',
                '/magic-link',
                '/auth',
                '/account',
                '/confirm-email-change',
                '/confirm-reauth',
                '/confirm-delete',
                '/admin',
                '/notes',
                '/board',
                '/cheer',
                '/payments',
                '/settings',
              ],
            },
          ],
        },
      }),
    ],
    server: {
      // 개발 중 Vite(5173) → Kotlin 백엔드(8080)로 /api/v1 요청 proxy
      // 프로덕션은 Caddy가 동일 origin으로 합쳐서 CORS 불필요
      // 한 서버에 프로젝트 여럿이면 `a.localhost:5174` · `b.localhost:5175` 로 연다 — 그 Host 가 백엔드까지 그대로 간다(devProxy.ts)
      // `localhost` · `*.localhost` · IP 는 Vite 가 기본으로 받는다. 그 밖의 도메인(터널 등)은 allowedHosts 에 더해야 한다
      allowedHosts: ['.localhost'],
      proxy: {
        '/api/v1': apiProxy(apiTarget),
        // 공개 접두사만 넘긴다 - 나머지 `/files/...` 는 S3 에 닿지 않는다(비공개 업로드 영역이 개발 서버를 통해 새지 않게)
        '/files/public': {
          target: filesTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/files/, ''),
        },
      },
    },
  }
})
