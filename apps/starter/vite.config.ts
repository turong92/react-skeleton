import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { themePrePaint } from '@skeleton/theme/vite'

export default defineConfig({
  plugins: [react(), themePrePaint()],
  server: {
    // 개발 중 Vite(5173) → Kotlin 백엔드(8080)로 /api/v1 요청 proxy
    // 프로덕션은 Caddy가 동일 origin으로 합쳐서 CORS 불필요
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
