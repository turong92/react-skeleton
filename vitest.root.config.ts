import { defineConfig } from 'vitest/config'

// (이름이 vitest.config.ts 가 아닌 이유: vitest 는 위 폴더의 config 도 찾아서 패키지 테스트가 이 설정을 물려받는다)
// 워크스페이스 전체를 가로지르는 테스트(tests/) — 각 앱 · 패키지의 테스트는 자기 폴더에서 `pnpm test` 가 돈다
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // 기본 5 s 는 부하가 큰 기계에서 이 폴더의 무거운 테스트(패키지 전부 import · 서버 렌더 · ESLint 규칙 검증)에 모자란다 — 걸리는 만큼만 쓰고, 멈춘 것은 with-watchdog 이 끊는다
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
