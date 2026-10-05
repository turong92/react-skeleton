import { defineConfig } from 'vitest/config'

/*
 * 브라우저 e2e — 진짜 백엔드(kotlin-skeleton apps/sample) + 진짜 Vite 서버 + Playwright chromium.
 * `pnpm e2e`(핵심 여정 검증) · `pnpm walkthrough`(같은 서버로 증거 스크린샷 · 녹화). 준비 · 정리는 e2e/globalSetup.ts.
 */
const walkthrough = process.env.E2E_WALKTHROUGH === '1'

export default defineConfig({
  test: {
    include: walkthrough
      ? ['e2e/walkthrough.shots.ts', 'e2e/walkthrough.board.shots.ts']
      : ['e2e/**/*.e2e.ts'],
    globalSetup: ['e2e/globalSetup.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 300_000, // 컨테이너 · 백엔드 첫 기동(그레이들)이 걸린다
  },
})
