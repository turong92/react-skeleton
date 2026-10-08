import { defineConfig } from 'vitest/config'

/*
 * 브라우저 e2e — 진짜 백엔드(kotlin-skeleton apps/sample) + 진짜 Vite 서버 + Playwright chromium.
 * `pnpm e2e`(핵심 여정 검증) · `pnpm walkthrough`(같은 서버로 증거 스크린샷 · 녹화). 준비 · 정리는 e2e/globalSetup.ts.
 */
const walkthrough = process.env.E2E_WALKTHROUGH === '1'
// 파일은 한 번에 하나씩 돈다: 가짜 제공자의 「다음 사용자」(`/control`) · 메일함 · 백엔드 한도는 파일 사이에 공유되는 상태다.
// `fileParallelism: false` 만으로는 모자란다 - 환경변수 `VITEST_MAX_WORKERS`(이 레포의 빌드 · 테스트 줄서기 훅이 4 로 준다)가 설정을 덮어써 파일이 나란히 돌았고,
// 한 파일의 `control` 이 다른 파일의 소셜 로그인 사용자를 바꿔 어쩌다 실패했다. 설정을 읽는 시점에 1 로 고정한다
process.env.VITEST_MAX_WORKERS = '1'

export default defineConfig({
  test: {
    include: walkthrough
      ? [
          'e2e/walkthrough.shots.ts',
          'e2e/walkthrough.board.shots.ts',
          'e2e/walkthrough.account.shots.ts',
          'e2e/walkthrough.social.shots.ts', // 가짜 제공자는 기본으로 켜져 있다(E2E_FAKE_PROVIDERS=0 이면 건너뛴다)
          'e2e/walkthrough.legal.shots.ts', // legal 모듈이 있는 백엔드일 때만 — 아니면 건너뛴다
          'e2e/walkthrough.email.shots.ts', // 이메일 필수 — 가짜 LINE(주소 없음) · mailpit
        ]
      : ['e2e/**/*.e2e.ts'],
    globalSetup: ['e2e/globalSetup.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 600_000, // 컨테이너 · 백엔드 첫 기동(그레이들)이 걸린다 — 부하가 큰 기계에서는 몇 분
  },
})
