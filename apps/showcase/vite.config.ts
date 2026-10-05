import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { themePrePaint } from '@skeleton/theme/vite'

// 쇼케이스는 백엔드 없이 돈다 — 프록시가 없다(데모는 모두 가짜 전송을 주입한다)
export default defineConfig({
  plugins: [react(), themePrePaint()],
})
