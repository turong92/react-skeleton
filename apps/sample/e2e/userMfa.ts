import type { Page } from 'playwright/test'
import { accessTokenFor, auth, dismissConsent } from './helpers'
import { ADMIN, api } from './paymentSteps'
import { createAuthenticatorApp } from './totp'

/*
 * 일반 사용자의 2단계 인증을 API 로 켜고 끄는 도우미 - 운영 권한(OPERATORS)이 붙는 역할을 사용자에게 주는 시험(`authzRoles` · `rewards`)이 쓴다.
 * 운영 권한이 붙은 계정은 서버가 2단계를 필수로 걸어 허용 목록 밖 호출이 403 `MFA.ENROLLMENT_REQUIRED` 로 막히므로, **역할을 주기 전에** 켜 둔다.
 * 켤 때 서버는 이 세션 말고 모든 세션을 닫는다 - 돌려주는 토큰만 살아 있고, 화면은 `signInWithCode` 로 다시 로그인한다. 끝나면 `resetUserMfa`(finally)로 끈다.
 */
export type UserMfa = { token: string; app: ReturnType<typeof createAuthenticatorApp> }

export async function enrollUserViaApi(
  apiUrl: string,
  account: { email: string; password: string },
): Promise<UserMfa> {
  const token = (await accessTokenFor(apiUrl, account, { strict: true }))!
  const started = await api(apiUrl, token, 'POST', '/auth/mfa/totp/enrollment', {
    currentPassword: account.password,
  })
  if (started.status !== 200) throw new Error(`mfa enrollment → ${started.status}`)
  const app = createAuthenticatorApp(started.json.value.secret as string)
  const confirmed = await api(apiUrl, token, 'POST', '/auth/mfa/totp/enrollment/confirm', {
    code: await app.code(),
  })
  if (confirmed.status !== 200) throw new Error(`mfa enrollment confirm → ${confirmed.status}`)
  return { token, app }
}

/** 운영 해제로 끈다 - 이미 꺼져 있으면 아무 일도 아니다(어느 단계에서 멈췄든 finally 에서 부른다) */
export async function resetUserMfa(apiUrl: string, email: string) {
  const adminToken = (await accessTokenFor(apiUrl, ADMIN, { strict: true }))!
  const found = await api(
    apiUrl,
    adminToken,
    'GET',
    `/admin/accounts?email=${encodeURIComponent(email)}`,
  )
  const id = found.json?.values?.[0]?.id as string | undefined
  if (!id) return
  const state = await api(apiUrl, adminToken, 'GET', `/admin/mfa/accounts/${id}`)
  if (state.json?.value?.enabled)
    await api(apiUrl, adminToken, 'POST', `/admin/mfa/accounts/${id}/reset`, {
      reason: 'e2e cleanup',
    })
}

/** 이 화면을 비우고(켤 때 서버가 세션을 닫았다) 이메일 · 비밀번호 + 인증 앱 코드로 다시 로그인한다 */
export async function signInWithCode(
  page: Page,
  baseUrl: string,
  account: { email: string; password: string },
  mfa: UserMfa,
) {
  await page.goto(baseUrl)
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await page.context().clearCookies()
  await page.goto(`${baseUrl}/login`)
  await dismissConsent(page)
  await page.getByLabel(auth.email).fill(account.email)
  await page.getByLabel(auth.password, { exact: false }).first().fill(account.password)
  await page.getByRole('button', { name: auth.signInSubmit, exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/login/two-factor')
  await page.getByLabel(auth.codeDigit(1, 6)).click()
  await page.keyboard.type(await mfa.app.code())
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
