import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { signOut } from './boardSteps'
import { auth, DEMO, dismissConsent, launch, signIn } from './helpers'
import { ADMIN, api, operatorPage, tokenOf } from './paymentSteps'
import { nextStep, totpAt } from './totp'

/*
 * 2단계 인증 (스펙 §6 흐름 ① ~ ④) - 진짜 백엔드(`auth-mfa` 모듈, `skeleton.auth-mfa.admin.enabled`) · 브라우저. 인증 앱은 시험 도우미(`totp.ts`)가 화면이 보여 준 비밀로 계산한다.
 *  ① 사용자가 설정에서 켠다(본인 확인 → 비밀 문자열 → 코드 → 복구 코드 열 개) → 로그아웃 → 로그인하면 코드를 묻고 → 코드로 들어간다
 *  ② 복구 코드로 들어가면 남은 복구 코드가 9개
 *  ③ 방금 쓴 코드를 다시 내면 거절된다
 *  ④ 운영자가 사유를 적어 해제한다 → 사용자는 코드 없이 로그인한다
 * 이 파일이 끝나면 사용자(DEMO)의 2단계는 꺼져 있어야 한다 - 뒤 파일이 같은 계정으로 코드 없이 로그인한다(중간에 실패해도 afterAll 이 운영자 해제로 되돌린다).
 * 2단계 모듈이 없는 백엔드(`GET /auth/mfa` 가 404)에서는 건너뛴다. ④ 는 운영 해제 경로가 닫힌 백엔드에서 건너뛴다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')

let browser: Browser
let page: Page
let on = false
let adminToken: string
let userId = ''
let resetOn = false

/** 사용자의 인증 앱 - 화면이 보여 준 비밀 · 마지막으로 쓴 걸음 · 복구 코드 */
let secret = ''
let lastStep = -1
let recoveryCodes: string[] = []
let usedCode = ''
/** 지금 낼 6자리 - 같은 걸음은 두 번 못 쓰므로 걸음은 앞으로만 간다(서버는 한 걸음 앞까지 받는다) */
async function appCode(): Promise<string> {
  const { step, waitMs } = nextStep(lastStep, Date.now())
  lastStep = step
  if (waitMs > 0) await new Promise((done) => setTimeout(done, waitMs + 250))
  return totpAt(secret, step)
}

beforeAll(async () => {
  ;({ browser, page } = await launch())
  const userToken = await tokenOf(apiUrl, DEMO)
  on = (await api(apiUrl, userToken, 'GET', '/auth/mfa')).status === 200
  if (!on) return
  adminToken = await tokenOf(apiUrl, ADMIN)
  const found = await api(
    apiUrl,
    adminToken,
    'GET',
    `/admin/accounts?email=${encodeURIComponent(DEMO.email)}`,
  )
  userId = found.json?.values?.[0]?.id ?? ''
  resetOn =
    userId !== '' &&
    (await api(apiUrl, adminToken, 'GET', `/admin/mfa/accounts/${userId}`)).status === 200
})
afterAll(async () => {
  // 어느 단계에서 실패했든 사용자를 2단계 꺼진 상태로 - 뒤 파일이 코드 없이 로그인한다
  if (resetOn) {
    const state = await api(apiUrl, adminToken, 'GET', `/admin/mfa/accounts/${userId}`)
    if (state.json?.value?.enabled)
      await api(apiUrl, adminToken, 'POST', `/admin/mfa/accounts/${userId}/reset`, {
        reason: 'e2e cleanup',
      })
  }
  await browser?.close()
})

const run = (name: string, fn: () => Promise<void>, needs: () => boolean = () => on) =>
  it(name, async (ctx) => {
    if (!needs()) return ctx.skip()
    await fn()
  })

/** 로그인 화면에서 이메일 · 비밀번호까지 - 2단계가 켜진 계정이면 코드 화면으로 넘어간다 */
async function passwordStep() {
  await page.goto(`${baseUrl}/login`)
  await dismissConsent(page)
  await page.getByLabel(auth.email).fill(DEMO.email)
  await page.getByLabel(auth.password, { exact: false }).first().fill(DEMO.password)
  await page.getByRole('button', { name: auth.signInSubmit, exact: true }).click()
  await pwExpect(page).toHaveURL(/\/login\/two-factor$/)
}
const typeCode = async (code: string) => {
  await page.getByLabel(auth.codeDigit(1, 6)).click()
  await page.keyboard.type(code)
}
const signedIn = () => pwExpect(page).not.toHaveURL(/\/login/)

describe('two-factor: turned on in settings, asked at every sign-in', () => {
  run(
    '① the user turns it on: password, key, code, then ten recovery codes kept until saved',
    async () => {
      await signIn(page, baseUrl)
      await page.goto(`${baseUrl}/account`)
      await page.getByRole('button', { name: auth.mfaEnable, exact: true }).click()
      const wizard = page.getByRole('dialog', { name: auth.mfaEnable })
      await wizard.getByLabel(auth.currentPassword, { exact: false }).first().fill(DEMO.password)
      await wizard.getByRole('button', { name: auth.mfaContinue, exact: true }).click()
      // 인증 앱에 넣는 비밀 문자열 - 화면이 보여 준 그대로 코드를 계산한다
      await pwExpect(wizard.getByRole('img', { name: auth.mfaQrLabel })).toBeVisible()
      secret = (await wizard.locator('code').first().innerText()).trim()
      baseExpect(secret).toMatch(/^[A-Z2-7]{16,}$/)
      await wizard.getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(await appCode())
      const codes = page.getByRole('dialog', { name: auth.mfaCodesTitle })
      recoveryCodes = (await codes.locator('li code').allInnerTexts()).map((c) => c.trim())
      baseExpect(recoveryCodes).toHaveLength(10)
      await codes.getByRole('button', { name: auth.mfaCodesSaved }).click()
      await pwExpect(page.getByText(auth.mfaOn, { exact: true })).toBeVisible()
    },
  )

  run('① signing in now asks for a code, and the app code gets in', async () => {
    await signOut(page)
    await passwordStep()
    usedCode = await appCode()
    await typeCode(usedCode)
    await signedIn()
  })

  run('② a recovery code gets in, and nine are left', async () => {
    await signOut(page)
    await passwordStep()
    await page.getByRole('button', { name: auth.mfaUseRecovery }).click()
    await page.getByLabel(auth.mfaRecoveryLabel).fill(recoveryCodes[0])
    await page.getByRole('button', { name: auth.mfaRecoverySubmit, exact: true }).click()
    await signedIn()
    await page.goto(`${baseUrl}/account`)
    await pwExpect(page.getByText(auth.mfaRecoveryRemaining(9))).toBeVisible()
  })

  run('③ the code that was just used is refused the second time', async () => {
    await signOut(page)
    await passwordStep()
    await typeCode(usedCode)
    await pwExpect(page.getByText(auth.mfaCodeWrong().replace(/\.$/, ''))).toBeVisible()
    await pwExpect(page).toHaveURL(/\/login\/two-factor$/)
  })

  run(
    '④ an operator resets it with a reason, and the user signs in without a code',
    async () => {
      const op = await operatorPage(browser, baseUrl)
      try {
        await op.page.goto(`${baseUrl}/admin/accounts`)
        await op.page.getByLabel(auth.adminSearch, { exact: true }).fill(DEMO.email)
        const row = op.page.getByRole('row').filter({ hasText: DEMO.email })
        await row.getByRole('button', { name: new RegExp(DEMO.email) }).click()
        await op.page.getByRole('menuitem', { name: auth.adminMfaReset, exact: true }).click()
        const dialog = op.page.getByRole('dialog', { name: auth.adminMfaResetTitle(DEMO.email) })
        // 사유는 필수다 - 비어 있으면 해제 단추가 눌리지 않는다
        await pwExpect(
          dialog.getByRole('button', { name: auth.adminMfaResetConfirm }),
        ).toBeDisabled()
        await dialog.getByLabel(auth.adminMfaResetReason).fill('e2e lost phone')
        await dialog.getByRole('button', { name: auth.adminMfaResetConfirm }).click()
        await pwExpect(op.page.getByText(auth.adminMfaResetDone(DEMO.email))).toBeVisible()
      } finally {
        await op.close()
      }
      await signIn(page, baseUrl) // 코드를 묻지 않는다
      const status = await api(apiUrl, await tokenOf(apiUrl, DEMO), 'GET', '/auth/mfa')
      baseExpect(status.json.value.enabled).toBe(false)
    },
    () => on && resetOn,
  )
})
