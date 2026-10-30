import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { koAdminApiKeysLabels } from '@skeleton/auth/admin'
import { koApiKeysLabels } from '@skeleton/auth/api-keys'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { auth, DEMO, ko, launch, signIn } from './helpers'
import { api, operatorPage, tokenOf } from './paymentSteps'

/*
 * API 키 (스펙 §6 흐름 ⑤ ⑥) - 진짜 백엔드(`api-key` 모듈, `skeleton.api-key.http.enabled` · `admin.enabled`) · 브라우저.
 *  ⑤ 사용자가 설정에서 키를 만든다(`notes.read`, 비밀번호로 다시 인증) → **브라우저 밖** `fetch` 로 키를 쓴다: `GET /notes` 200 · `POST /notes` 403(범위 없음) · `/account/me` 403(키로는 계정 경로에 못 들어간다)
 *     → 화면에서 회수하면 같은 키가 401.
 *  ⑥ 운영자가 사용자의 다른 키를 사유와 함께 회수한다 → 운영 표에 사유, 사용자 설정에는 「운영자가 회수」, 그 키는 401.
 * 키 기능이 없는 백엔드(`GET /api-keys` 가 404)에서는 건너뛴다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const stamp = Date.now()
const mine = koApiKeysLabels as Required<typeof koApiKeysLabels>
const admin = koAdminApiKeysLabels as Required<typeof koAdminApiKeysLabels>
const screenKey = `e2e 화면 키 ${stamp}`
const operatorKey = `e2e 운영 키 ${stamp}`
const reason = `e2e 유출 신고 ${stamp}`

let browser: Browser
let page: Page
let on = false
let userToken: string
beforeAll(async () => {
  ;({ browser, page } = await launch())
  userToken = await tokenOf(apiUrl, DEMO)
  on = (await api(apiUrl, userToken, 'GET', '/api-keys')).status === 200
})
afterAll(async () => {
  await browser?.close()
})

const run = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!on) return ctx.skip()
    await fn()
  })

/** 키로 부른다 - 브라우저 밖이라 쿠키도 로그인도 없다. 키는 `Authorization: Bearer` 로만 간다 */
const withKey = (token: string, method: string, path: string) =>
  api(apiUrl, token, method, path, method === 'POST' ? { title: 'by key', body: '' } : undefined, {
    ...(method === 'POST' ? { 'Idempotency-Key': `e2e-key-${stamp}` } : {}),
  })

describe('API keys: the owner makes one on the settings screen and uses it outside the browser', () => {
  let token: string

  run('creates a notes.read key on the screen, shown once', async () => {
    await signIn(page, baseUrl)
    await page.goto(`${baseUrl}/settings`)
    await page.getByRole('button', { name: mine.create, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: mine.createTitle })
    await dialog.getByLabel(mine.nameLabel).fill(screenKey)
    await dialog.getByRole('checkbox', { name: ko('apiKeys.scope.notesRead') }).check()
    await dialog.getByLabel(auth.currentPassword, { exact: false }).first().fill(DEMO.password)
    await dialog.getByRole('button', { name: mine.submit, exact: true }).click()
    const shown = page.getByRole('dialog', { name: mine.tokenTitle })
    token = (await shown.getByTestId('api-key-token').innerText()).trim()
    baseExpect(token).toMatch(/^notes_/)
    await pwExpect(shown.getByText(mine.tokenOnce)).toBeVisible()
    await shown.getByRole('button', { name: mine.tokenDone }).click()
    await pwExpect(page.getByText(screenKey)).toBeVisible()
  })

  run(
    'the key reads notes (200), cannot write (403) and cannot reach the account (403)',
    async () => {
      baseExpect((await withKey(token, 'GET', '/notes')).status).toBe(200)
      baseExpect((await withKey(token, 'POST', '/notes')).status).toBe(403)
      baseExpect((await withKey(token, 'GET', '/account/me')).status).toBe(403)
    },
  )

  run('revoking it on the screen cuts it off at once (401)', async () => {
    await page.getByRole('button', { name: mine.revokeFor(screenKey) }).click()
    const confirm = page.getByRole('dialog', { name: mine.revokeTitle(screenKey) })
    await confirm.getByRole('button', { name: mine.revokeConfirm, exact: true }).click()
    await pwExpect(confirm).toBeHidden()
    await pwExpect(page.getByText(mine.revokedByYou)).toBeVisible()
    baseExpect((await withKey(token, 'GET', '/notes')).status).toBe(401)
  })
})

describe('API keys: an operator revokes another key with a reason', () => {
  run(
    'the operator table shows the reason, the owner sees "revoked by an operator", the key is dead',
    async () => {
      const created = await api(apiUrl, userToken, 'POST', '/api-keys', {
        name: operatorKey,
        scopes: ['notes.read'],
        expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        currentPassword: DEMO.password,
      })
      baseExpect(created.status).toBe(201)
      const operatorToken: string = created.json.value.token
      baseExpect((await withKey(operatorToken, 'GET', '/notes')).status).toBe(200)

      const op = await operatorPage(browser, baseUrl)
      try {
        await op.page.goto(`${baseUrl}/admin/api-keys`)
        await pwExpect(op.page.getByRole('table', { name: admin.caption })).toBeVisible()
        await op.page
          .getByRole('button', { name: new RegExp(`^${operatorKey}\\(.*\\) 회수$`) })
          .click()
        const dialog = op.page.getByRole('dialog', { name: admin.revokeTitle })
        await dialog.getByLabel(admin.revokeReason).fill(reason)
        await dialog.getByRole('button', { name: admin.revokeConfirm, exact: true }).click()
        await pwExpect(dialog).toBeHidden()
        const row = op.page.getByRole('row').filter({ hasText: operatorKey })
        await pwExpect(row.getByText(admin.revokedByOperator)).toBeVisible()
        await pwExpect(row.getByText(admin.revokedReason(reason))).toBeVisible()
      } finally {
        await op.close()
      }

      await page.goto(`${baseUrl}/settings`)
      await pwExpect(page.getByText(operatorKey)).toBeVisible()
      await pwExpect(page.getByText(mine.revokedByOperator)).toBeVisible()
      baseExpect((await withKey(operatorToken, 'GET', '/notes')).status).toBe(401)
    },
  )
})
