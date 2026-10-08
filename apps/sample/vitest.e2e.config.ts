import { defineConfig } from 'vitest/config'

/*
 * 브라우저 e2e — 진짜 백엔드(kotlin-skeleton apps/sample) + 진짜 Vite 서버 + Playwright chromium.
 * `pnpm e2e`(핵심 여정 검증) · `pnpm walkthrough`(같은 서버로 증거 스크린샷 · 녹화). 준비 · 정리는 e2e/globalSetup.ts.
 *
 * `pnpm e2e` 는 백엔드를 **두 번** 올려 두 판을 차례로 돈다: `e2e:main`(표준 구성) 다음 `e2e:reauth`(`E2E_PASS=reauth` — 첫 이메일 등록의 재인증 면제 창이 없는 구성, `emailReauth.e2e.ts` 만).
 * 「마지막 로그인이 1시간을 넘었다」는 서버 구성이 달라야 만들 수 있어서 따로 돈다. 면제를 시험하는 다른 파일은 그 구성에서 맞지 않는다.
 */
const walkthrough = process.env.E2E_WALKTHROUGH === '1'
const reauthPass = process.env.E2E_PASS === 'reauth'
if (reauthPass) process.env.E2E_EMAIL_REAUTH_WINDOW ??= 'PT0S'

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
      : reauthPass
        ? ['e2e/emailReauth.e2e.ts']
        : ['e2e/**/*.e2e.ts'],
    exclude: reauthPass ? [] : ['e2e/emailReauth.e2e.ts', '**/node_modules/**'],
    globalSetup: ['e2e/globalSetup.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 600_000, // 컨테이너 · 백엔드 첫 기동(그레이들)이 걸린다 — 부하가 큰 기계에서는 몇 분
  },
})
