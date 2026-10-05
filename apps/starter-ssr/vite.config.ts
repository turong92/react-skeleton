import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { seoFiles } from '@skeleton/seo/vite'
import { themePrePaint } from '@skeleton/theme/vite'

export default defineConfig({
  plugins: [
    react(),
    themePrePaint(),
    // 빌드가 sitemap.xml · robots.txt 를 dist/client 에 낸다 — SITE_URL(공개 주소)이 없으면 robots.txt 만. 공개 페이지만 적는다(계정 · 로그인 뒤 화면은 넣지 않는다)
    seoFiles({ baseUrl: process.env.SITE_URL, routes: ['/'] }),
  ],
  // 서버 번들은 모든 의존을 안에 담는다 — 프로덕션 실행에 node_modules 가 필요 없다(Docker 런타임 이미지는 dist 와 server 만 복사)
  ssr: { noExternal: true },
  server: {
    // 개발 중 /api/v1 은 Kotlin 백엔드(8080)로 — 브라우저 요청만. 서버 렌더가 부르는 백엔드 주소는 API_BASE_URL(server/config.ts)
    // 프로덕션은 Caddy 가 /api/v1 → 백엔드, 나머지 → 이 서버로 같은 origin 에 합친다
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
