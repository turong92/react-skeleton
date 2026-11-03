import { koBroadcastAdminLabels } from '@skeleton/notifications/admin'
import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { signInAs, USER } from './boardSteps'
import { ko, launch } from './helpers'
import { operatorPage } from './paymentSteps'

/*
 * 공지 발송 여정 (스펙 §9 의 e2e 한 줄) — 진짜 백엔드(`notification-broadcast` 를 켠 견본, `skeleton.notification.broadcast.admin.enabled=true`) · 브라우저.
 *   운영자: 새 공지(대상 전체, 알림함만) → 「나에게 테스트」(벨에 `[테스트]`) → 「보내기」 → 확인 창(대상 n명) → 상세가 「보냄」
 *   사용자: 벨에 공지 → 「읽음으로 표시」 → 운영자 상세의 「알림함 읽음」 이 1
 * 푸시 경로(클릭 보고)는 kotlin 통합 시험과 push.e2e.ts 가 맡는다. 아직 실행하지 않았다면 kotlin 의 K4(견본이 공지를 켬)를 합친 백엔드(`scripts/sample-e2e-backend.sh`)가 있어야 돈다:
 * `pnpm e2e:sample e2e/broadcast.e2e.ts`.
 */
const pwExpect = baseExpect.configure({ timeout: 30_000 })
const baseUrl = inject('baseUrl')
const L = koBroadcastAdminLabels
const TITLE = `점검 안내 ${Date.now()}`

let browser: Browser
let userPage: Page
let closeOperator: () => Promise<void>
let operator: Page
beforeAll(async () => {
  ;({ browser, page: userPage } = await launch())
  const op = await operatorPage(browser, baseUrl)
  operator = op.page
  closeOperator = op.close
})
afterAll(async () => {
  await closeOperator?.()
  await browser?.close()
})

/** 벨을 열어 알림 목록에서 찾는다 - 서버가 일꾼으로 넣는 줄은 늦게 올 수 있어, 열 때마다 목록을 다시 불러오는 점을 이용해 닫았다 다시 열며 기다린다 */
async function bellShows(page: Page, text: string) {
  await baseExpect(async () => {
    await page.getByRole('button', { name: /^알림/ }).click()
    try {
      await baseExpect(page.getByText(text).first()).toBeVisible({ timeout: 3_000 })
    } catch (failure) {
      await page.keyboard.press('Escape')
      throw failure
    }
  }).toPass({ timeout: 60_000 })
}

/** 새 공지 양식 - 종류는 첫 번째(서비스 공지), 대상은 전체(기본값 - 시드 사용자는 저장된 역할이 없어 역할 USER 대상에 안 든다), 알림함만(푸시 칸은 건드리지 않는다) */
async function fillForm(page: Page) {
  await page.goto(`${baseUrl}/admin/broadcasts/new`)
  await page.getByLabel(new RegExp(`^${L.editor.title}`)).fill(TITLE)
  await page.getByLabel(new RegExp(`^${L.editor.body}`)).fill('오늘 밤 점검이 있어요.')
  await pwExpect(page.getByRole('status').filter({ hasText: /^대상 \d+명$/ })).toBeVisible()
}

describe('공지 발송 여정', () => {
  it('운영자가 공지를 만들어 테스트하고 보내면, 사용자가 벨에서 읽고, 운영자 상세에 읽음 1이 보인다', async () => {
    await fillForm(operator)

    // 나에게 테스트 - 제목 앞에 [테스트] 가 붙어 운영자 벨에 온다
    await operator.getByRole('button', { name: L.editor.test, exact: true }).click()
    await pwExpect(operator.getByText(L.editor.testSent)).toBeVisible()
    await bellShows(operator, `[테스트] ${TITLE}`)
    await operator.keyboard.press('Escape')

    // 보내기 - 확인 창이 대상 수를 다시 보여 주고, 눌러야 나간다
    await operator.getByRole('button', { name: L.editor.send, exact: true }).click()
    await pwExpect(operator.getByText(L.confirm.sendTitle)).toBeVisible()
    await operator.getByRole('button', { name: /명에게 보내기$/ }).click()

    // 상세 - 보내는 중이면 10초마다 다시 읽다가 「보냄」
    await pwExpect(operator).toHaveURL(/\/admin\/broadcasts\/bc_[^/]+$/)
    await pwExpect(operator.getByText(L.status.SENT, { exact: true })).toBeVisible({
      timeout: 90_000,
    })
    const detailUrl = operator.url()

    // 사용자 - 벨에 공지, 읽음으로 표시
    await signInAs(userPage, baseUrl, USER)
    await bellShows(userPage, TITLE)
    await userPage
      .getByRole('dialog')
      .getByRole('button', { name: ko('header.markRead') })
      .first()
      .click()

    // 운영자 상세 - 알림함 읽음 1
    await operator.goto(detailUrl)
    const read = operator
      .locator('#broadcast-stats dl')
      .filter({ has: operator.getByText(L.detail.stats.inboxRead, { exact: true }) })
    await pwExpect(read.locator('dd').first()).toHaveText('1')
  }, 300_000)
})
