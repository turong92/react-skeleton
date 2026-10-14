import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { seoFiles } from '@skeleton/seo/vite'
import { themePrePaint } from '@skeleton/theme/vite'
import { apiProxy } from './devProxy.ts'

// 백엔드를 다른 주소 · 포트로 띄웠다면: API_PROXY_TARGET=http://localhost:18080 pnpm dev (기본 8080)
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8080'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    themePrePaint(),
    // 빌드가 sitemap.xml · robots.txt 를 낸다 — 공개 페이지만 적고(랜딩 · 약관 · 방침), 로그인 뒤 화면은 robots 에서 막는다.
    // 공개 주소는 VITE_SITE_URL(.env 또는 빌드 환경변수) — 없으면 robots.txt 만 내고 경고한다
    seoFiles({
      baseUrl: loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL || undefined,
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
    proxy: { '/api/v1': apiProxy(apiTarget) },
  },
}))
