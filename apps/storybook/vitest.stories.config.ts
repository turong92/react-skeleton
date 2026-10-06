import { defineConfig } from 'vitest/config'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'

/* 스토리 = 테스트. 진짜 브라우저(Playwright chromium, headless)에서 모든 스토리를 그리고 play · a11y 를 돌린다 — `pnpm test:stories` */
export default defineConfig({
  plugins: [storybookTest({ configDir: '.storybook' })],
  test: {
    name: 'storybook',
    // 진짜 브라우저 · 번들 예열이 부하에서 느려진다 — play 안의 findBy/waitFor 는 .storybook/preview.tsx 의 asyncUtilTimeout 이, 스토리 한 개 전체는 이 값이 받친다
    testTimeout: 90_000,
    hookTimeout: 180_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
