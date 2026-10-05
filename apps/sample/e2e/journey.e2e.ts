import { expect as pwExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { ko, launch, seedNotes, signIn } from './helpers'

/*
 * 핵심 여정 — 랜딩(로그아웃 상태의 `/` · 동의 배너 · 약관 · 404) → 로그인 → 빈 대시보드 → 만들기(검증 오류 → 성공) → 알림 → 첨부 업로드 → 내보내기 → 목록(검색 · 필터 · 쪽) → 수정 → 삭제 → 설정(테마) → 로그아웃.
 * 진짜 백엔드 · 진짜 브라우저. 한 흐름이라 단계가 앞 단계의 결과에 기댄다(앞이 실패하면 뒤는 의미 없다).
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')

let browser: Browser
let context: BrowserContext
let page: Page

beforeAll(async () => {
  ;({ browser, context, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

const bell = () => page.getByRole('button', { name: /^알림/ })
const heading = (name: string | RegExp, level = 1) => page.getByRole('heading', { level, name })

describe('Notes — the main journey against the real backend', () => {
  it('a signed-out visitor lands on the landing page, answers the consent banner (remembered), reads a legal page and a 404, then goes on to the login', async () => {
    await page.goto(baseUrl)
    await pwExpect(heading(ko('landing.title'))).toBeVisible()
    await pwExpect(page).toHaveTitle(new RegExp(ko('seo.landing.title')))
    // 구조화된 머리: 공개 페이지는 canonical 이 아닌 robots 없음 · 랜딩의 FAQ 구조화 데이터
    await pwExpect(page.locator('script[type="application/ld+json"]')).toHaveCount(1)
    const banner = page.getByRole('region', { name: ko('consent.title') })
    await pwExpect(banner).toBeVisible()
    await page.getByRole('button', { name: ko('consent.rejectAll') }).click()
    await pwExpect(banner).toHaveCount(0)
    await page.reload()
    await pwExpect(heading(ko('landing.title'))).toBeVisible()
    await pwExpect(banner).toHaveCount(0) // 선택은 기억된다

    // 요금제: 연 결제로 바꾸면 한 달 값 + 연 총액
    await page.getByRole('button', { name: new RegExp(ko('landing.pricing.yearly')) }).click()
    await pwExpect(page.getByText(/^연 .*결제$/).first()).toBeVisible()

    // 약관(템플릿): 푸터 링크 → 템플릿 표시 → 옛 판
    await page.getByRole('link', { name: ko('footer.terms') }).click()
    await pwExpect(heading(ko('legal.terms.title'))).toBeVisible()
    await pwExpect(page.getByRole('alert')).toContainText('템플릿')
    await page.getByLabel(ko('legal.switcher')).selectOption('1.0')
    await pwExpect(page).toHaveURL(/\?v=1\.0$/)
    await pwExpect(page.getByText(ko('legal.older', { current: '2.0' }))).toBeVisible()
    await pwExpect(page).toHaveTitle(new RegExp(ko('seo.terms.title')))

    // 없는 주소: 404 화면 · 검색에서 뺀다
    await page.goto(`${baseUrl}/no-such-page`)
    await pwExpect(heading(ko('notFound.title'))).toBeVisible()
    await pwExpect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    )

    // 랜딩 → 로그인
    await page.goto(baseUrl)
    await page.getByRole('link', { name: ko('landing.primary'), exact: true }).click()
    await pwExpect(page).toHaveURL(/\/login$/)
    await pwExpect(heading(ko('login.title'))).toBeVisible()
  })

  it('rejects a wrong password, then signs in with the demo account', async () => {
    await page.getByLabel(ko('login.email')).fill('user@example.com')
    await page.getByLabel(ko('login.password')).fill('not-the-password')
    await page.getByRole('button', { name: ko('login.submit'), exact: true }).click()
    await pwExpect(page.getByRole('alert')).toContainText(ko('login.invalid'))

    await signIn(page, baseUrl)
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
  })

  it('shows an honest empty dashboard with the way to the first note', async () => {
    await pwExpect(page.getByRole('heading', { name: ko('dashboard.emptyTitle') })).toBeVisible()
    await pwExpect(
      page.getByRole('heading', { name: ko('dashboard.unreadEmptyTitle') }),
    ).toBeVisible()
    await pwExpect(page.getByRole('region', { name: ko('dashboard.statsLabel') })).toContainText(
      '0',
    )
  })

  it('create form: client check, then the backend 400 lands on the body field, then success', async () => {
    await page
      .getByRole('button', { name: ko('dashboard.create') })
      .first()
      .click()
    await pwExpect(heading(ko('form.createTitle'))).toBeVisible()

    await page.getByRole('button', { name: ko('form.submitCreate') }).click()
    await pwExpect(page.getByText(ko('form.titleRequired'))).toBeVisible()
    await pwExpect(page.getByLabel(new RegExp(ko('form.title')))).toBeFocused()

    await page.getByLabel(new RegExp(ko('form.title'))).fill('주간 회의 정리')
    await page.getByLabel(ko('form.body')).fill('가'.repeat(5001))
    await page.getByRole('button', { name: ko('form.submitCreate') }).click()
    // 서버 검증(Size) 오류가 본문 칸 아래에 한국어로 — 영어 서버 메시지가 아니라
    await pwExpect(page.getByText(ko('validation.Size'))).toBeVisible()
    await pwExpect(page.getByLabel(ko('form.body'))).toHaveAttribute('aria-invalid', 'true')
    await pwExpect(page.getByLabel(/주간 회의|제목/)).toBeVisible()

    await page.getByLabel(ko('form.body')).fill('안건: 1) 일정 2) 담당자 3) 다음 주 목표')
    await page.getByLabel(ko('form.status')).selectOption('ACTIVE')
    await page.getByRole('checkbox', { name: new RegExp(ko('form.pinned')) }).check()
    await page.getByRole('button', { name: ko('form.submitCreate') }).click()

    await pwExpect(heading('주간 회의 정리')).toBeVisible()
    // 확인 토스트는 백엔드가 발행한 알림(SSE)이다 — 화면이 만든 문구가 아니다
    await pwExpect(page.getByText('노트를 만들었어요').first()).toBeVisible()
  })

  it('the backend published a notification: the bell counts it and the inbox shows it', async () => {
    await pwExpect(bell()).toHaveAccessibleName(/안 읽은 알림 [1-9]/)
    await bell().click()
    const dialog = page.getByRole('dialog', { name: ko('header.notificationsTitle') })
    await pwExpect(dialog).toContainText('주간 회의 정리')
    await dialog.getByRole('button', { name: ko('header.markAllRead') }).click()
    await pwExpect(bell()).toHaveAccessibleName(ko('header.bell', { unread: 0 }))
    await dialog.getByRole('button', { name: ko('common.close') }).click()
  })

  it('uploads an attachment with progress and keeps it on the note', async () => {
    await page.getByRole('tab', { name: ko('detail.tabAttachment') }).click()
    await pwExpect(page.getByText(ko('attachment.none'))).toBeVisible()
    await page.locator('input[type=file]').setInputFiles({
      name: 'agenda.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('다음 주 안건 목록\n'.repeat(50)),
    })
    await pwExpect(page.getByText('agenda.txt')).toBeVisible()
    await pwExpect(page.getByText(ko('attachment.none'))).toBeHidden()

    // 새로고침해도 서버에 남아 있다
    await page.reload()
    await page.getByRole('tab', { name: ko('detail.tabAttachment') }).click()
    await pwExpect(page.getByText('agenda.txt')).toBeVisible()
    const popup = context.waitForEvent('page')
    await page.getByRole('button', { name: ko('attachment.download') }).click()
    const opened = await popup
    // presigned 주소로 열린다(로컬 S3)
    await opened.waitForLoadState('domcontentloaded')
    pwExpect(opened.url()).toContain('agenda.txt')
    await opened.close()
  })

  it('an unsupported file is refused with a sentence the user can act on', async () => {
    await page.locator('input[type=file]').setInputFiles({
      name: 'setup.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('MZ'),
    })
    await pwExpect(
      page.getByRole('alert').filter({ hasText: ko('attachment.unsupported') }),
    ).toBeVisible()
  })

  it('export enqueues a job and its completion arrives as a notification', async () => {
    await page.getByRole('button', { name: ko('detail.export') }).click()
    await pwExpect(page.getByText(ko('detail.exportStarted'))).toBeVisible()
    await pwExpect(bell()).toHaveAccessibleName(/안 읽은 알림 [1-9]/, { timeout: 30_000 })
  })

  it('list: search, status filter, pagination and the no-results state', async () => {
    await seedNotes(
      apiUrl,
      Array.from({ length: 12 }, (_, i) => ({
        title: `프로젝트 메모 ${String(i + 1).padStart(2, '0')}`,
        status: i % 2 === 0 ? ('DRAFT' as const) : ('ARCHIVED' as const),
      })),
    )
    await page.getByRole('link', { name: ko('nav.notes'), exact: true }).click()
    await pwExpect(heading(ko('notes.title'))).toBeVisible()
    const rows = page.getByRole('table', { name: ko('notes.caption') }).getByRole('row')
    await pwExpect(rows).toHaveCount(11) // 머리글 + 10행
    // 고정한 노트가 맨 위
    await pwExpect(rows.nth(1)).toContainText('주간 회의 정리')

    await page.getByRole('button', { name: '2쪽' }).click()
    await pwExpect(page).toHaveURL(/page=2/)
    await pwExpect(rows).toHaveCount(4) // 13개 중 3개

    await page.getByRole('searchbox', { name: ko('notes.search') }).fill('회의')
    await pwExpect(rows).toHaveCount(2)
    await pwExpect(page).toHaveURL(/q=%ED%9A%8C%EC%9D%98|q=회의/)

    await page.getByRole('searchbox', { name: ko('notes.search') }).fill('없는-검색어')
    await pwExpect(page.getByRole('heading', { name: ko('notes.noResultsTitle') })).toBeVisible()
    await page.getByRole('button', { name: ko('notes.clearFilters') }).click()
    await pwExpect(rows).toHaveCount(11)

    await page.getByLabel(ko('notes.statusFilter')).selectOption('ARCHIVED')
    await pwExpect(rows).toHaveCount(7) // 보관 6개 + 머리글
  })

  it('edit saves through PUT and the detail shows the new title', async () => {
    await page
      .getByRole('link', { name: '주간 회의 정리' })
      .first()
      .click()
      .catch(async () => {
        await page.goto(`${baseUrl}/notes?q=${encodeURIComponent('주간')}`)
        await page.getByRole('link', { name: '주간 회의 정리' }).click()
      })
    await page.getByRole('button', { name: ko('common.edit') }).click()
    await page.getByLabel(new RegExp(ko('form.title'))).fill('주간 회의 정리 (수정)')
    await page.getByRole('button', { name: ko('form.submitEdit') }).click()
    await pwExpect(heading('주간 회의 정리 (수정)')).toBeVisible()
  })

  it('delete asks first, then the note is gone and the list tells the truth', async () => {
    await page.getByRole('button', { name: ko('detail.deleteButton') }).click()
    const dialog = page.getByRole('dialog')
    await pwExpect(dialog).toContainText('주간 회의 정리 (수정)')
    await dialog.getByRole('button', { name: ko('detail.deleteConfirm') }).click()
    await pwExpect(heading(ko('notes.title'))).toBeVisible()
    await pwExpect(page.getByRole('link', { name: '주간 회의 정리 (수정)' })).toHaveCount(0)
  })

  it('the create form works with the keyboard alone: Enter submits, an empty title keeps focus on the title', async () => {
    await page.goto(`${baseUrl}/notes/new`)
    const title = page.getByLabel(new RegExp(ko('form.title')))
    await title.focus()
    await page.keyboard.press('Enter') // 빈 제목 — 제출은 막히고 포커스는 제목에 남는다
    await pwExpect(page.getByText(ko('form.titleRequired'))).toBeVisible()
    await pwExpect(title).toBeFocused()
    await page.keyboard.type('키보드로 만든 노트')
    await page.keyboard.press('Tab') // 본문
    await page.keyboard.type('마우스 없이도 끝까지 된다')
    await page.getByLabel(new RegExp(ko('form.title'))).focus()
    await page.keyboard.press('Enter')
    await pwExpect(heading('키보드로 만든 노트')).toBeVisible()
  })

  it('settings: the theme switches at once, account is shown; sign out returns to login and guards routes', async () => {
    await page.getByRole('link', { name: ko('nav.settings') }).click()
    await page.getByLabel(ko('settings.theme')).selectOption('dark')
    await pwExpect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await pwExpect(page.getByText('user@example.com')).toBeVisible()

    await page
      .getByRole('button', { name: ko('header.signOut') })
      .first()
      .click()
    await pwExpect(heading(ko('login.title'))).toBeVisible()
    await page.goto(`${baseUrl}/notes`)
    await pwExpect(heading(ko('login.title'))).toBeVisible() // 보호된 경로는 로그인으로
  })
})
