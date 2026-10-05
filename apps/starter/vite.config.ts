import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { themePrePaint } from '@skeleton/theme/vite'

// 백엔드를 다른 주소 · 포트로 띄웠다면: API_PROXY_TARGET=http://localhost:18080 pnpm dev (기본 8080)
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react(), themePrePaint()],
  server: {
    // 개발 중 Vite(5173) → Kotlin 백엔드(8080)로 /api/v1 요청 proxy
    // 프로덕션은 Caddy가 동일 origin으로 합쳐서 CORS 불필요
    proxy: {
      '/api/v1': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
