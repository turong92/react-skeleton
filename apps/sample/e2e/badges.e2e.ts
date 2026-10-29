import { koRewardsAdminLabels } from '@skeleton/rewards/admin'
import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { rewardsLabelsFor } from '../src/rewards/labels'
import { dismissConsent, ko, launch } from './helpers'
import { ADMIN, api, ensureSignedIn, operatorPage, tokenOf } from './paymentSteps'

/*
 * 배지 · 업적 (스펙 §8) — 진짜 백엔드(`badge` · `campaign` 업적 · `reward` · `notification`, `skeleton.badge.admin.enabled=true`, 씨앗 `BadgesSeed`) · 브라우저.
 *  ① 사용자가 노트를 만들면 업적 이벤트가 「첫 노트」를 준다 - 내 배지 화면의 「받은 배지」에 보이고, 숨은 「비밀 손님」은 「?」(숨은 배지)로만 있다
 *  ② 로그아웃 상태(새 브라우저)로 그 계정의 공개 프로필 줄을 열면 「첫 노트」와 손으로 받은 「비밀 손님」(받으면 이름이 보인다)이 보인다. 「프로필에 보이기」를 끄면 그 배지만 줄에서 사라진다
 *  ③ 운영자가 「얼리 버드」를 수동 수여 → 사용자 화면에 나타난다
 *  ④ 운영자가 내역에서 회수(사유 필수) → 「받은 배지」에서 사라지고 내역에 「회수」 줄과 사유가 남는다
 * 시나리오는 서로 기대지 않는다 - 전제는 API 로 깔고, 손으로 준 배지(얼리 버드 · 비밀 손님)와 껐던 스위치는 시나리오마다 `finally` 와 파일 앞 · 뒤(`beforeAll` · `afterAll`)에서 되돌려
 * 한 시나리오가 중간에 멈춰도 다음 시나리오 · 다음 실행이 남은 상태를 만나지 않는다. 노트로 받은 배지(첫 노트)는 업적이라 되돌리지 않는다(멱등).
 * 이 백엔드에 배지 운영 경로가 없으면(404) 시나리오를 건너뛴다. 아직 실행하지 않았다 - 백엔드(`scripts/sample-e2e-backend.sh`)를 띄운 뒤 `pnpm e2e:sample e2e/badges.e2e.ts`.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
// 화면이 쓰는 문구 그대로 - 앱이 패키지 문구를 덮어쓴다(「프로필」 대신 「공개 배지」)
const L = rewardsLabelsFor('ko')
const A = koRewardsAdminLabels
const LATE = 120_000

// 씨앗의 배지(`BadgesSeed`) - 코드는 서버와 같고 이름은 사람이 읽는 것
const FIRST_NOTE = { code: 'first-note', name: '첫 노트' }
const EARLY_BIRD = { code: 'early-bird', name: '얼리 버드' }
const SECRET_GUEST = { code: 'secret-guest', name: '비밀 손님' }
const MANUAL = [EARLY_BIRD, SECRET_GUEST]
const USER_EMAIL = 'user@example.com'

let browser: Browser
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
  await resetState() // 앞선 실행이 남긴 손으로 준 배지 · 꺼 둔 스위치
})
afterAll(async () => {
  try {
    await resetState()
  } finally {
    await browser?.close()
  }
})

type Held = { awardId: string; code: string; visible: boolean }
type Row = { id: string; awardId: string; action: 'AWARDED' | 'REVOKED' }

/** 이 경로가 이 백엔드에 있는가 - 404 만 「없다」, 나머지 실패는 던진다 */
async function exists(token: string, path: string): Promise<boolean> {
  const answer = await api(apiUrl, token, 'GET', path)
  if (answer.status === 404) return false
  if (answer.status >= 400) throw new Error(`GET ${path} → ${answer.status}`)
  return true
}

async function accountIdOf(token: string): Promise<string> {
  const me = await api(apiUrl, token, 'GET', '/account/me')
  if (me.status !== 200) throw new Error(`GET /account/me → ${me.status}`)
  return me.json.value.id as string
}

const earnedOf = async (token: string): Promise<Held[]> =>
  (await api(apiUrl, token, 'GET', '/badges/me')).json.value.earned as Held[]

async function badgeIdOf(adminToken: string, code: string): Promise<string> {
  const list = (await api(apiUrl, adminToken, 'GET', '/admin/badges')).json.values as Array<{
    id: string
    code: string
  }>
  const found = list.find((b) => b.code === code)
  if (!found) throw new Error(`seed badge ${code} is missing - is the local seed on?`)
  return found.id
}

/** 운영자 API 로 손으로 수여한다 - 시나리오의 전제만 API 로 깐다 */
async function awardByApi(adminToken: string, userId: string, code: string) {
  const id = await badgeIdOf(adminToken, code)
  const done = await api(apiUrl, adminToken, 'POST', `/admin/badges/${id}/awards`, {
    accountIds: [userId],
    reason: 'e2e',
  })
  if (done.status !== 200) throw new Error(`award ${code} → ${done.status}`)
}

/**
 * 되돌리기 - 손으로 준 배지를 회수하고(내역에서 보유 줄마다 가장 최근 줄이 「수여」인 것), 꺼 둔 「프로필에 보이기」를 다시 켠다.
 * 이미 깨끗하면 아무 일도 아니고, 이 백엔드에 배지가 없으면(404) 그대로 돌아온다. 화면 단계가 어디서 멈췄어도 된다(API 로 한다)
 */
async function resetState() {
  const adminToken = await tokenOf(apiUrl, ADMIN)
  if (!(await exists(adminToken, '/admin/badges'))) return
  const userToken = await tokenOf(apiUrl)
  const userId = await accountIdOf(userToken)
  const handled = new Set<string>()
  let cursor: string | undefined
  do {
    const query = `accountId=${encodeURIComponent(userId)}&size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const page = await api(apiUrl, adminToken, 'GET', `/admin/badge-awards?${query}`)
    const rows = page.json.values as Array<Row & { badgeCode: string | null }>
    for (const row of rows) {
      if (handled.has(row.awardId)) continue
      handled.add(row.awardId)
      if (row.action === 'AWARDED' && MANUAL.some((b) => b.code === row.badgeCode))
        await api(apiUrl, adminToken, 'POST', `/admin/badge-awards/${row.awardId}/revoke`, {
          reason: 'e2e cleanup',
        })
    }
    cursor = page.json.cursor?.hasNext ? (page.json.cursor.nextCursor as string) : undefined
  } while (cursor)
  for (const held of await earnedOf(userToken))
    if (!held.visible)
      await api(apiUrl, userToken, 'PATCH', `/badges/me/${held.awardId}`, { visible: true })
}

/** 내 배지 화면의 구역 - 「받은 배지」 · 「아직 받지 못한 배지」 */
const section = (p: Page, name: string) => p.getByRole('region', { name })
const openShelf = async (p: Page) => {
  await p.goto(`${baseUrl}/rewards/badges`)
  await pwExpect(
    p.getByRole('heading', { level: 1, name: ko('rewards.badges.title') }),
  ).toBeVisible()
}

/** 화면에서 노트를 하나 만든다(업적 이벤트의 입력은 노트 개수다) */
async function makeNote(p: Page) {
  await p.goto(`${baseUrl}/notes/new`)
  await p.getByLabel(new RegExp(ko('form.title'))).fill(`배지 시연 ${Date.now()}`)
  await p.getByRole('button', { name: ko('form.submitCreate') }).click()
  await pwExpect(p.getByRole('heading', { level: 1 })).not.toHaveText(ko('form.createTitle'))
}

/** 로그인하지 않은 새 브라우저 컨텍스트 */
async function anonymousPage(b: Browser) {
  const context: BrowserContext = await b.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  context.setDefaultTimeout(15_000)
  const p = await context.newPage()
  return { page: p, close: () => context.close() }
}

/** 공개 프로필의 배지 줄 - 비어 있으면 줄 자체가 없다 */
async function profileRow(b: Browser, accountId: string) {
  const anonymous = await anonymousPage(b)
  await anonymous.page.goto(`${baseUrl}/profile/${accountId}`)
  await dismissConsent(anonymous.page)
  await pwExpect(
    anonymous.page.getByRole('heading', { level: 1, name: ko('profile.title') }),
  ).toBeVisible()
  return anonymous
}

describe('badges: a note brings one, the public profile shows it, an operator awards and revokes by hand', () => {
  it(
    'making a note brings 첫 노트 to the shelf (a hidden badge stays a question mark), and a notification when it is new',
    async (ctx) => {
      const adminToken = await tokenOf(apiUrl, ADMIN)
      if (!(await exists(adminToken, '/admin/badges'))) return ctx.skip()
      const token = await tokenOf(apiUrl)
      const heldBefore = (await earnedOf(token)).some((b) => b.code === FIRST_NOTE.code)
      const unread = async () =>
        (await api(apiUrl, token, 'GET', '/notifications/unread-count')).json.value.count as number
      const unreadBefore = await unread()

      await ensureSignedIn(page, baseUrl)
      await makeNote(page)

      // 노트 저장 → 업적 이벤트 → 일꾼 → 지급기 - 비동기라 도착할 때까지 기다린다
      await pwExpect
        .poll(async () => (await earnedOf(token)).map((b) => b.code), { timeout: 60_000 })
        .toContain(FIRST_NOTE.code)
      await openShelf(page)
      await pwExpect(section(page, L.badge.earned).getByText(FIRST_NOTE.name)).toBeVisible()
      // 숨은 배지는 이름 없이 「숨은 배지」 로만 있다
      const locked = section(page, L.badge.locked)
      await pwExpect(locked.getByText(L.badge.hiddenName)).toBeVisible()
      await pwExpect(page.getByText(SECRET_GUEST.name)).toHaveCount(0)
      if (!heldBefore)
        await pwExpect.poll(unread, { timeout: 60_000 }).toBeGreaterThan(unreadBefore)
    },
    LATE,
  )

  it(
    'a signed-out visitor sees the account profile row with 첫 노트 and the hidden badge once it is held; switching 프로필에 보이기 off removes it from the row',
    async (ctx) => {
      const adminToken = await tokenOf(apiUrl, ADMIN)
      if (!(await exists(adminToken, '/admin/badges'))) return ctx.skip()
      const token = await tokenOf(apiUrl)
      const userId = await accountIdOf(token)
      // 전제 - 첫 노트를 가진 상태(앞 시나리오 없이도): 없으면 노트를 하나 만들어 받는다
      if (!(await earnedOf(token)).some((b) => b.code === FIRST_NOTE.code)) {
        await ensureSignedIn(page, baseUrl)
        await makeNote(page)
        await pwExpect
          .poll(async () => (await earnedOf(token)).map((b) => b.code), { timeout: 60_000 })
          .toContain(FIRST_NOTE.code)
      }
      try {
        await awardByApi(adminToken, userId, SECRET_GUEST.code) // 손으로 받은 숨은 배지 - 받으면 이름이 보이고 공개 줄에도 나간다
        const held = (await earnedOf(token)).find((b) => b.code === FIRST_NOTE.code) as Held
        if (!held.visible)
          await api(apiUrl, token, 'PATCH', `/badges/me/${held.awardId}`, { visible: true })

        const visitor = await profileRow(browser, userId)
        try {
          const row = visitor.page.getByRole('list', { name: L.badge.profileTitle })
          await pwExpect(row.getByText(FIRST_NOTE.name)).toBeVisible()
          await pwExpect(row.getByText(SECRET_GUEST.name)).toBeVisible() // 손으로 받아 보이게 둔 배지는 나간다
        } finally {
          await visitor.close()
        }

        // 사용자가 화면에서 첫 노트의 스위치를 끈다 -> 방문자의 줄에서 사라진다
        await ensureSignedIn(page, baseUrl)
        await openShelf(page)
        const tile = section(page, L.badge.earned)
          .getByRole('listitem')
          .filter({ hasText: FIRST_NOTE.name })
        const toggle = tile.getByRole('switch', { name: L.badge.showOnProfileFor(FIRST_NOTE.name) })
        await pwExpect(toggle).toBeChecked()
        await toggle.click()
        await pwExpect(toggle).not.toBeChecked()

        const again = await profileRow(browser, userId)
        try {
          const row = again.page.getByRole('list', { name: L.badge.profileTitle })
          await pwExpect(row.getByText(SECRET_GUEST.name)).toBeVisible()
          await pwExpect(again.page.getByText(FIRST_NOTE.name)).toHaveCount(0)
        } finally {
          await again.close()
        }
      } finally {
        await resetState() // 껐던 스위치를 켜고 손으로 준 배지를 거둔다
      }
    },
    LATE,
  )

  it(
    'an operator awards 얼리 버드 by hand (n awarded · m already held) and it shows up on the user shelf',
    async (ctx) => {
      const adminToken = await tokenOf(apiUrl, ADMIN)
      if (!(await exists(adminToken, '/admin/badges'))) return ctx.skip()
      const token = await tokenOf(apiUrl)
      await resetState()
      const unread = async () =>
        (await api(apiUrl, token, 'GET', '/notifications/unread-count')).json.value.count as number
      const unreadBefore = await unread()
      const operator = await operatorPage(browser, baseUrl)
      try {
        const op = operator.page
        await op.goto(`${baseUrl}/admin/badges`)
        await op.getByRole('button', { name: A.badges.awardFor(EARLY_BIRD.name) }).click()
        const dialog = op.getByRole('dialog', { name: A.badges.awardTitle(EARLY_BIRD.name) })
        await dialog.getByLabel(A.accountSearch.label).fill(USER_EMAIL)
        await dialog.getByRole('button', { name: A.accountSearch.submit }).click()
        await dialog
          .getByRole('button', { name: A.accountSearch.pick(USER_EMAIL), exact: true })
          .click()
        await dialog.getByLabel(A.badges.reason).fill('e2e 수동 수여')
        await dialog.getByRole('button', { name: A.badges.award, exact: true }).click()
        await pwExpect(dialog.getByText(A.badges.awardedResult(1, 0))).toBeVisible()

        await pwExpect
          .poll(async () => (await earnedOf(token)).map((b) => b.code), { timeout: 30_000 })
          .toContain(EARLY_BIRD.code)
        await ensureSignedIn(page, baseUrl)
        await openShelf(page)
        await pwExpect(section(page, L.badge.earned).getByText(EARLY_BIRD.name)).toBeVisible()
        // 받았다는 알림이 하나 도착한다
        await pwExpect.poll(unread, { timeout: 60_000 }).toBeGreaterThan(unreadBefore)
        // 내역에 운영자가 준 「수여」 줄이 남는다
        await op.goto(`${baseUrl}/admin/badge-awards`)
        await pwExpect(
          op
            .getByRole('table', { name: A.badgeAwards.caption })
            .getByRole('row')
            .filter({ hasText: EARLY_BIRD.name })
            .filter({ hasText: A.badgeAwards.actions.AWARDED })
            .filter({ hasText: A.badgeAwards.sources.ADMIN })
            .first(),
        ).toBeVisible()
      } finally {
        await operator.close()
        await resetState()
      }
    },
    LATE,
  )

  it(
    'revoking from the history needs a reason; afterwards 얼리 버드 leaves the earned list and the history keeps a 회수 line with the reason',
    async (ctx) => {
      const adminToken = await tokenOf(apiUrl, ADMIN)
      if (!(await exists(adminToken, '/admin/badges'))) return ctx.skip()
      const token = await tokenOf(apiUrl)
      const userId = await accountIdOf(token)
      await resetState()
      await awardByApi(adminToken, userId, EARLY_BIRD.code)
      const operator = await operatorPage(browser, baseUrl)
      try {
        const op = operator.page
        await op.goto(`${baseUrl}/admin/badge-awards`)
        const revoke = op.getByRole('button', {
          name: new RegExp(`^${A.badgeAwards.revoke}: ${EARLY_BIRD.name}`),
        })
        await revoke.first().click()
        const dialog = op.getByRole('dialog', { name: A.badgeAwards.revokeTitle })
        const confirm = dialog.getByRole('button', { name: A.badgeAwards.revoke, exact: true })
        await pwExpect(confirm).toBeDisabled() // 사유 없이는 회수할 수 없다
        await dialog.getByLabel(new RegExp(`^${A.badgeAwards.revokeReason}`)).fill('e2e 잘못 줌')
        await confirm.click()
        await pwExpect(dialog).toBeHidden()

        await pwExpect
          .poll(async () => (await earnedOf(token)).map((b) => b.code), { timeout: 30_000 })
          .not.toContain(EARLY_BIRD.code)
        await ensureSignedIn(page, baseUrl)
        await openShelf(page)
        await pwExpect(section(page, L.badge.earned).getByText(EARLY_BIRD.name)).toHaveCount(0)

        await op.reload()
        const table = op.getByRole('table', { name: A.badgeAwards.caption })
        await pwExpect(
          table
            .getByRole('row')
            .filter({ hasText: A.badgeAwards.actions.REVOKED })
            .filter({ hasText: 'e2e 잘못 줌' })
            .first(),
        ).toBeVisible()
      } finally {
        await operator.close()
        await resetState()
      }
    },
    LATE,
  )
})
