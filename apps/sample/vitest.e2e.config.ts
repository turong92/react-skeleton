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
          'e2e/walkthrough.email.shots.ts', // 이메일 필수(쓰기 때) — 가짜 LINE(주소 없음) · mailpit
          'e2e/walkthrough.loginId.shots.ts', // 로그인 아이디 — 가입 양식 · 로그인 · 아이디 찾기 · 게이트 · 설정 · 관리자 표 · 메일 (ko · en)
          'e2e/walkthrough.settings.shots.ts', // 설정의 입력 동작이 대화상자로 뜨는 모습 — 구역 읽기 상태 · 대화상자 · 구역 칩 이동 · 이메일 없는 계정의 수단 연결 (1280 · 375)
          'e2e/walkthrough.subscription.shots.ts', // 구독 — 플랜 목록 · 카드 등록 뒤 결과 · 내 구독 · 해지 예약 확인 창 · 해지 예약된 상태 (1280 · 375) + 320px 가로 밀림 측정 (구독이 없는 백엔드면 건너뛴다)
        ]
      : ['e2e/**/*.e2e.ts'],
    globalSetup: ['e2e/globalSetup.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 90_000,
    // globalSetup 의 정리(백엔드 `stop`: JVM 종료 + 컨테이너 · 볼륨 내리기)를 기다리는 시간 - 기본 10초면 vitest 가 먼저 process.exit() 해 정리가 끊기고 컨테이너 · 볼륨 · PID 파일이 남는다
    teardownTimeout: 120_000,
    hookTimeout: 600_000, // 컨테이너 · 백엔드 첫 기동(그레이들)이 걸린다 — 부하가 큰 기계에서는 몇 분
  },
})
