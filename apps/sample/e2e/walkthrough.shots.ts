import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect as pwExpect, type Page } from 'playwright/test'
import { describe, inject, it } from 'vitest'
import { auth, dismissConsent, fillSignIn, ko, launch, seedNotes, DEMO } from './helpers'

/*
 * 소유자에게 보이는 증거 — 같은 서버 · 같은 여정을 사람이 보는 속도로 밟으며 스크린샷(라이트 10 + 다크 2 + 모바일 · 알림 덤)과 녹화(.webm → .mp4 · .gif)를 남긴다.
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample walkthrough`  (테스트가 아니다 — `pnpm e2e` 에는 들어가지 않는다)
 * 폴더에 `captions.md`(파일 → 한 줄 설명)도 함께 쓴다.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')

const captions: Array<[string, string]> = []
async function shot(page: Page, file: string, caption: string, fullPage = false) {
  await page.waitForTimeout(500) // 전환 · 토스트가 자리 잡게
  await page.screenshot({ path: join(out, file), fullPage })
  captions.push([file, caption])
}

describe('walkthrough', () => {
  it('walks the journey and saves the evidence', async () => {
    mkdirSync(out, { recursive: true })
    const { browser, context, page } = await launch({ recordVideoDir: join(out, '_video') })
    const pause = (ms = 700) => page.waitForTimeout(ms)
    const bell = () => page.getByRole('button', { name: /^알림/ })
    try {
      // 0 랜딩(로그아웃 상태의 `/`) — 동의 배너가 떠 있는 첫 방문
      await page.goto(baseUrl)
      await shot(
        page,
        '00-landing.png',
        '로그인하지 않은 방문자의 첫 화면 — Patterns/Landing(@skeleton/marketing) + 아래 동의 배너(모두 거부 · 모두 허용이 같은 무게)',
      )
      await dismissConsent(page)
      await page.getByRole('link', { name: ko('header.signIn'), exact: true }).click()

      // 1 로그인
      await page.getByLabel(auth.email).fill(DEMO.email)
      await page.getByLabel(auth.password).first().fill(DEMO.password)
      await shot(
        page,
        '01-login.png',
        '로그인 — 체험 계정을 채운 모습. Patterns/Auth/Sign in + @skeleton/auth(JWT)',
      )
      await fillSignIn(page, DEMO)

      // 2 첫 대시보드(빈 상태)
      await page.getByRole('heading', { name: ko('dashboard.emptyTitle') }).waitFor()
      await shot(
        page,
        '02-dashboard-empty.png',
        '처음 들어온 대시보드 — 숫자는 0, 다음에 할 일을 알려 주는 빈 상태. Patterns/Dashboard page (Stat · Table empty · EmptyState)',
      )

      // 3 만들기 — 서버 검증 오류가 칸 아래에
      await page
        .getByRole('button', { name: ko('dashboard.create') })
        .first()
        .click()
      await page.getByLabel(new RegExp(ko('form.title'))).fill('주간 회의 정리')
      await page
        .getByLabel(ko('form.body'))
        .fill('회의 안건을 정리해 둡니다. '.repeat(400).slice(0, 5001))
      await page.getByRole('button', { name: ko('form.submitCreate') }).click()
      await page.getByText(ko('validation.Size')).waitFor()
      await shot(
        page,
        '03-form-validation.png',
        '새 노트 — 본문이 너무 길어 백엔드가 400 을 돌려주면 같은 칸 아래에 한국어로. Patterns/Form page + platform ApiError.errors[]',
      )

      // 4 만들기 성공 → 상세 + 토스트 + 종 배지(실시간)
      await page
        .getByLabel(ko('form.body'))
        .fill(
          '안건: 1) 일정 점검  2) 담당자 확정  3) 다음 주 목표 세우기\n\n메모: 금요일까지 초안 공유.',
        )
      await page.getByLabel(ko('form.status')).selectOption('ACTIVE')
      await page.getByRole('checkbox', { name: new RegExp(ko('form.pinned')) }).check()
      await page.getByRole('button', { name: ko('form.submitCreate') }).click()
      await page.getByRole('heading', { level: 1, name: '주간 회의 정리' }).waitFor()
      await pwExpect(bell()).toHaveAccessibleName(/안 읽은 알림 [1-9]/)
      await shot(
        page,
        '04-detail-created.png',
        '저장하면 상세로 이동 — 토스트와 종 배지의 새 알림은 백엔드가 SSE 로 밀어 준다. Patterns/Detail page + notification-sse',
      )

      // 5 받은편지함
      await bell().click()
      await page.getByRole('dialog').getByText('주간 회의 정리').first().waitFor()
      await shot(
        page,
        '05-inbox.png',
        '종을 누르면 받은편지함 — 읽지 않은 알림에 표시. NotificationBell(@skeleton/notifications) + notification-jdbc',
      )
      await page
        .getByRole('dialog')
        .getByRole('button', { name: ko('header.markAllRead') })
        .click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: ko('common.close') })
        .click()

      // 6 첨부 업로드(진행률) — 업로드를 느리게 해 진행 중 모습을 담는다
      await page.getByRole('tab', { name: ko('detail.tabAttachment') }).click()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 30,
        downloadThroughput: -1,
        uploadThroughput: 400 * 1024,
      })
      await page.locator('input[type=file]').setInputFiles({
        name: 'floorplan.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(2 * 1024 * 1024, 7),
      })
      await page.getByRole('progressbar').waitFor()
      await page.waitForTimeout(2200)
      await shot(
        page,
        '06-upload-progress.png',
        '파일을 고르면 브라우저가 저장소(S3)로 직접 올린다 — 진행률과 취소. FilePicker · Progress(@skeleton/ui) + @skeleton/storage useUpload + storage-s3 presign',
      )
      await pwExpect(page.getByText('floorplan.png')).toBeVisible({ timeout: 30_000 })
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      })

      // 7 첨부 완료
      await shot(
        page,
        '07-attachment-done.png',
        '올린 키가 노트에 저장돼 파일 카드로 — 내려받기는 짧은 수명 presigned 주소. Detail 탭 + PUT /notes/{id}',
      )

      // 8 내보내기 → 잡 완료 알림(덤)
      await page.getByRole('button', { name: ko('detail.export') }).click()
      await pwExpect(bell()).toHaveAccessibleName(/안 읽은 알림 [1-9]/, { timeout: 30_000 })
      await bell().click()
      await page
        .getByRole('dialog')
        .getByText(/내보내/)
        .first()
        .waitFor()
      await shot(
        page,
        '14-export-notification.png',
        '[덤] 「내보내기」는 job-queue-jdbc 에 잡을 넣고 202 로 돌려준다 — 잡이 끝나면 같은 받은편지함에 알림이 온다',
      )
      await page
        .getByRole('dialog')
        .getByRole('button', { name: ko('common.close') })
        .click()

      // 9 목록 — 여러 개를 시드해 쪽 이동 · 고정 · 상태가 보이게
      await seedNotes(apiUrl, [
        { title: '이사 체크리스트', status: 'DRAFT', pinned: true },
        { title: '여름 휴가 계획', body: '항공권 · 숙소 · 렌터카', status: 'DRAFT' },
        { title: '독서 목록 2026', status: 'ACTIVE' },
        { title: '사이드 프로젝트 아이디어', status: 'ARCHIVED' },
        { title: '장보기 목록', status: 'ACTIVE' },
        { title: '블로그 초안: 홈서버 이야기', status: 'DRAFT' },
        { title: '운동 루틴', status: 'ACTIVE' },
        { title: '회고 메모', status: 'ARCHIVED' },
        { title: '영수증 모음', status: 'ACTIVE' },
        { title: '세금 신고 준비', status: 'DRAFT' },
        { title: '회의록 템플릿', status: 'ACTIVE' },
        { title: '여행 사진 정리', status: 'ARCHIVED' },
      ])
      await page.getByRole('link', { name: ko('nav.notes'), exact: true }).click()
      await page.getByRole('table', { name: ko('notes.caption') }).waitFor()
      // 시드한 노트마다 실시간 토스트가 뜨므로 모두 사라질 때까지 기다린다(실제 사용에서는 한 번에 하나)
      await page.waitForFunction(
        () => document.querySelectorAll('[data-sonner-toast]').length === 0,
        null,
        { timeout: 60_000 },
      )
      await shot(
        page,
        '08-list.png',
        '노트 목록 — 고정한 노트가 맨 위, 상태 · 첨부 배지, 쪽 이동. Patterns/List page + 서버 페이지네이션(Response.ok(items, pagination))',
      )

      // 10 검색 + 필터
      await page.getByRole('searchbox', { name: ko('notes.search') }).fill('회의')
      await pwExpect(
        page.getByRole('table', { name: ko('notes.caption') }).getByRole('row'),
      ).toHaveCount(3)
      await shot(
        page,
        '09-list-search.png',
        '검색어는 주소(?q=회의)에 남아 새로고침 · 링크 공유가 된다 — 결과 없음에는 「필터 지우기」. List page 의 빈 상태 변형',
      )
      await page.getByRole('searchbox', { name: ko('notes.search') }).fill('')
      await pwExpect(
        page.getByRole('table', { name: ko('notes.caption') }).getByRole('row'),
      ).toHaveCount(11)

      // 11 대시보드(채워진) — 다크 두 장
      await page.getByRole('link', { name: ko('nav.dashboard') }).click()
      await page.getByRole('heading', { name: /안녕하세요/ }).waitFor()
      await page.emulateMedia({ colorScheme: 'dark' })
      await shot(
        page,
        '11-dashboard-dark.png',
        '[다크] 채워진 대시보드 — 같은 토큰이 다크에서도 AA 대비를 지킨다. 테마는 <html data-theme> 한 곳(@skeleton/theme)',
      )
      await page.getByRole('link', { name: '주간 회의 정리' }).first().click()
      await page.getByRole('heading', { level: 1, name: '주간 회의 정리' }).waitFor()
      await shot(
        page,
        '12-detail-dark.png',
        '[다크] 상세 — 탭 · 위험 구역 · Badge. 색은 의미 토큰만',
      )
      await page.emulateMedia({ colorScheme: 'light' })

      // 12 설정
      await page.getByRole('link', { name: ko('nav.settings') }).click()
      await page.getByRole('heading', { level: 1, name: ko('settings.title') }).waitFor()
      await shot(
        page,
        '10-settings.png',
        '설정 — 테마는 고르는 즉시 적용, 계정 정보는 /auth/me. Patterns/Settings page(저장할 서버 설정이 없어 저장 폼은 뺐다)',
      )

      // 13 모바일(덤)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.getByRole('link', { name: ko('nav.notes'), exact: true }).click()
      await page.getByRole('table', { name: ko('notes.caption') }).waitFor()
      await shot(
        page,
        '13-list-mobile.png',
        '[덤] 390px 폭 — 헤더 메뉴가 둘째 줄로, 검색 · 필터가 세로로, 표는 가로 스크롤. AppShell 컨테이너 쿼리',
      )
      await page.setViewportSize({ width: 1280, height: 800 })

      // 로그아웃
      await page
        .getByRole('button', { name: ko('header.signOut') })
        .first()
        .click()
      await page.getByRole('heading', { level: 1, name: ko('login.title') }).waitFor()
      await pause(900)
    } finally {
      const video = page.video()
      await context.close()
      await browser.close()
      const webm = await video?.path()
      if (webm) {
        const base = join(out, 'journey')
        copyFileSync(webm, `${base}.webm`)
        // ffmpeg 가 있으면 mp4 · gif 도(새 의존 없음 — 없으면 .webm 만)
        const have = spawnSync('ffmpeg', ['-version']).status === 0
        if (have) {
          spawnSync('ffmpeg', [
            '-y',
            '-i',
            `${base}.webm`,
            '-movflags',
            '+faststart',
            '-pix_fmt',
            'yuv420p',
            `${base}.mp4`,
          ])
          spawnSync('ffmpeg', [
            '-y',
            '-i',
            `${base}.webm`,
            '-vf',
            'fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
            `${base}.gif`,
          ])
        }
      }
      const sorted = [...captions].sort(([a], [b]) => a.localeCompare(b))
      writeFileSync(
        join(out, 'captions.md'),
        `# Notes 샘플 — 여정 증거\n\n파일 → 캡션 (번호 순). \`journey.webm\`/\`.mp4\`/\`.gif\` 는 같은 여정의 녹화.\n\n${sorted.map(([f, c]) => `- \`${f}\` — ${c}`).join('\n')}\n`,
      )
    }
  }, 280_000)
})
