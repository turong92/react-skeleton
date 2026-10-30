import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { koWorkspaceLabels } from '@skeleton/workspace'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import {
  agreeToLegal,
  auth,
  DEMO,
  dismissConsent,
  fillLoginId,
  fillSignIn,
  ko,
  launch,
  uniqueLoginId,
} from './helpers'
import { waitForCode, waitForLink } from './mail'

/*
 * 워크스페이스(팀) 한 여정 - 진짜 백엔드(apps/sample, 씨앗 계정 user@example.com 이 소유자인 `example-team`) · 진짜 브라우저 · 진짜 메일(mailpit).
 *  user 가 워크스페이스를 만든다 -> 새 주소를 초대 -> 메일의 링크(/invite?token=) -> 그 사람이 로그인 · 가입 화면으로 갔다가 새 계정으로 가입(인증번호) -> 같은 링크로 돌아와 수락
 *  -> 둘이 같은 팀 노트를 본다(내 노트에는 안 나온다) -> 두 탭에 다른 팀(요청 헤더도 탭마다 다르다 · 새로고침해도 안 섞인다 · 「마지막에 쓴 팀」은 /workspaces 만 읽는다)
 *  -> 주소 이름을 바꾸면 옛 주소가 새 주소로 넘어간다 -> 로그인 안 한 채 /w/<slug>/… 를 열면 로그인 뒤 그 주소로 돌아온다
 *  -> user 가 추방하면 그 사람의 다음 요청부터 목록에서 사라지고 그 팀의 주소 · 노트는 404.
 * 한 흐름이라 단계가 앞 단계의 결과에 기댄다.
 */
const pwExpect = baseExpect.configure({ timeout: 30_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')

const w = koWorkspaceLabels
const tail = String(Date.now()).slice(-6)
const teamName = `Journey ${tail}`
const noteTitle = `팀 노트 ${tail}`
const inviteeEmail = `invitee-${tail}@example.com`
const inviteePassword = 'Correct-horse-9'
const seen = new Set<string>()

let browser: Browser
let userContext: BrowserContext
let user: Page // 만든 사람(첫 탭)
let inviteeContext: BrowserContext
let invitee: Page
let slug = ''
let teamId = ''

beforeAll(async () => {
  ;({ browser, context: userContext, page: user } = await launch())
  inviteeContext = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 800 },
  })
  inviteeContext.setDefaultTimeout(15_000)
  invitee = await inviteeContext.newPage()
})
afterAll(async () => {
  await browser?.close()
})

/** 이 탭이 노트 API 로 보낸 팀 헤더 - 탭마다 자기 팀의 id 만 싣는다 */
function watchTeamHeader(page: Page) {
  const ids: string[] = []
  page.on('request', (request) => {
    const header = request.headers()['x-workspace-id']
    if (request.url().includes('/api/v1/notes') && header) ids.push(header)
  })
  return ids
}

/** 노트 목록 응답 하나 - 「없다」를 단언하기 전에 목록이 실제로 왔는지 기다린다(그 전에는 당연히 없다) */
const listLoaded = (page: Page) =>
  page.waitForResponse(
    (r) => /\/api\/v1\/notes(\?|$)/.test(r.url()) && r.request().method() === 'GET',
  )

const switcher = (page: Page) => page.getByRole('button', { name: /^워크스페이스 (고르기|바꾸기)/ })
const slugOf = (page: Page) => /\/w\/([^/?#]+)/.exec(page.url())?.[1] ?? ''
const tokenOf = (page: Page) =>
  page.evaluate(() => window.localStorage.getItem('sample.accessToken'))

/** 인증번호 칸에 6자리를 친다(첫 칸에서 시작 - 다 채우면 버튼 없이 제출된다) */
async function enterCode(page: Page, code: string) {
  await page.getByLabel(auth.codeDigit(1, 6)).click()
  await page.keyboard.type(code)
}

describe('workspace journey', () => {
  it('user creates a workspace from the header switcher and lands on its notes (/w/<slug>/notes)', async () => {
    await user.goto(baseUrl)
    await dismissConsent(user)
    await user
      .getByRole('link', { name: ko('header.signIn') })
      .first()
      .click()
    await fillSignIn(user, DEMO)
    await pwExpect(user.getByRole('heading', { level: 1 }).first()).toBeVisible()

    await switcher(user).click()
    await user.getByRole('menuitem', { name: w.switcher.create }).click()
    await pwExpect(user).toHaveURL(/\/workspaces\/new$/)
    await user.getByLabel(w.form.nameLabel).fill(teamName)
    await user.getByRole('button', { name: w.create.submit }).click()
    await pwExpect(user).toHaveURL(/\/w\/[^/]+\/notes$/)
    slug = slugOf(user)
    pwExpect(slug).toContain(tail)
    await pwExpect(switcher(user)).toHaveAccessibleName(w.switcher.trigger(teamName))
  })

  it('invites a new address; the mail carries /invite?token= ', async () => {
    await user
      .getByRole('navigation', { name: ko('workspace.tabsLabel') })
      .getByRole('link', { name: ko('nav.settings') })
      .click()
    await pwExpect(user).toHaveURL(new RegExp(`/w/${slug}/settings$`))
    await user.getByLabel(w.invitations.emailsLabel).fill(inviteeEmail)
    await user.getByRole('button', { name: w.invitations.send }).click()
    await pwExpect(user.getByText(w.invitations.result.invited(1))).toBeVisible()
    await pwExpect(user.getByText(inviteeEmail)).toBeVisible() // 답을 기다리는 초대 표
  })

  it('the invitee opens the mail link (no login needed), signs up with the code, comes back and accepts', async () => {
    const link = await waitForLink(mailUrl, inviteeEmail, 'invite', { seen })
    pwExpect(link.path).toMatch(/^\/invite\?token=/)
    await invitee.goto(`${baseUrl}${link.path}`)
    await dismissConsent(invitee)
    await pwExpect(invitee.getByText(w.accept.invitedTo(teamName))).toBeVisible()
    pwExpect(invitee.url()).not.toContain('token=') // 토큰은 주소창에서 지워졌다

    await invitee.getByRole('button', { name: w.accept.signIn }).click()
    await pwExpect(invitee).toHaveURL(/\/login$/)
    await invitee.getByRole('link', { name: auth.signInCreateAccount }).click()
    await invitee.getByLabel(auth.displayName).fill('초대받은 사람')
    await fillLoginId(invitee, uniqueLoginId('inv'))
    await invitee.getByLabel(auth.email).fill(inviteeEmail)
    await pwExpect(invitee.getByLabel(auth.email)).toHaveValue(inviteeEmail)
    await invitee.getByLabel(auth.password).first().fill(inviteePassword)
    await invitee.getByLabel(auth.passwordConfirm).fill(inviteePassword)
    await agreeToLegal(invitee, apiUrl)
    await invitee.getByRole('button', { name: auth.signUpSubmit }).click()
    const verify = await waitForCode(mailUrl, inviteeEmail, 'verify', { seen })
    await enterCode(invitee, verify.code)
    await pwExpect(invitee.getByRole('heading', { name: /안녕하세요/ })).toBeVisible()

    // 같은 탭이라 토큰이 남아 있다 - 메일의 링크를 다시 열면 이어서 수락한다
    await invitee.goto(`${baseUrl}${link.path}`)
    await invitee.getByRole('button', { name: w.accept.accept }).click()
    await pwExpect(invitee).toHaveURL(new RegExp(`/w/${slug}/notes$`))
    await pwExpect(switcher(invitee)).toHaveAccessibleName(w.switcher.trigger(teamName))
  })

  it('both see the same team notes - and the team note is not among "my notes"', async () => {
    await user.goto(`${baseUrl}/w/${slug}/notes`)
    await user
      .getByRole('button', { name: ko('notes.create') })
      .first()
      .click()
    await user.getByLabel(new RegExp(ko('form.title'))).fill(noteTitle)
    await user.getByRole('button', { name: ko('form.submitCreate') }).click()
    await pwExpect(user.getByRole('heading', { name: noteTitle })).toBeVisible()
    await pwExpect(user).toHaveURL(new RegExp(`/w/${slug}/notes/[^/]+$`)) // 팀 안의 주소로 이동한다

    await invitee.goto(`${baseUrl}/w/${slug}/notes`)
    await pwExpect(invitee.getByRole('link', { name: noteTitle })).toBeVisible()

    const mine = listLoaded(user)
    await user.goto(`${baseUrl}/notes`) // 헤더가 없는 내 노트
    await mine
    await pwExpect(user.getByRole('heading', { level: 1, name: ko('notes.title') })).toBeVisible()
    await pwExpect(user.getByRole('link', { name: noteTitle })).toHaveCount(0)
  })

  it('two tabs, two teams: each tab reads its team from the address, headers differ, reloads do not mix them', async () => {
    const tabA = user
    const tabB = await userContext.newPage()
    const headersA = watchTeamHeader(tabA)
    const headersB = watchTeamHeader(tabB)
    const loadedA = listLoaded(tabA)
    const loadedB = listLoaded(tabB)
    await tabA.goto(`${baseUrl}/w/${slug}/notes`)
    await tabB.goto(`${baseUrl}/w/example-team/notes`)
    await Promise.all([loadedA, loadedB])
    await pwExpect(tabA.getByRole('link', { name: noteTitle })).toBeVisible()
    await pwExpect(switcher(tabB)).toHaveAccessibleName(/Example Team/)
    await pwExpect(tabB.getByRole('link', { name: noteTitle })).toHaveCount(0)
    pwExpect(new Set(headersA).size).toBe(1)
    pwExpect(new Set(headersB).size).toBe(1)
    pwExpect(headersA[0]).not.toBe(headersB[0])
    teamId = headersA[0]

    const reloadedA = listLoaded(tabA)
    await tabA.reload()
    await reloadedA
    const reloadedB = listLoaded(tabB)
    await tabB.reload() // 마지막에 연 곳은 B(example-team)
    await reloadedB
    await pwExpect(tabA.getByRole('link', { name: noteTitle })).toBeVisible()
    await pwExpect(tabB.getByRole('link', { name: noteTitle })).toHaveCount(0)
    pwExpect(slugOf(tabA)).toBe(slug)
    pwExpect(slugOf(tabB)).toBe('example-team')

    // 「마지막에 쓴 팀」은 첫 화면(/workspaces)을 열 때만 읽는다 - 주소에 팀이 있는 탭은 읽지 않는다
    const first = await userContext.newPage()
    await first.goto(`${baseUrl}/workspaces`)
    await pwExpect(first).toHaveURL(/\/w\/example-team\/notes$/)
    await first.close()
    pwExpect(slugOf(tabA)).toBe(slug)
    await tabB.close()
  })

  it('renaming the address makes the old address forward to the new one (replace)', async () => {
    const renamed = `${slug}-v2`
    await user.goto(`${baseUrl}/w/${slug}/settings`)
    await user.getByLabel(new RegExp(`^${w.form.slugLabel}`)).fill(renamed)
    await user.getByRole('button', { name: w.settings.save }).click()
    await pwExpect(user).toHaveURL(new RegExp(`/w/${renamed}/settings$`))

    const old = await userContext.newPage()
    await old.goto(`${baseUrl}/w/${slug}/notes`)
    await pwExpect(old).toHaveURL(new RegExp(`/w/${renamed}/notes$`))
    await pwExpect(old.getByRole('link', { name: noteTitle })).toBeVisible()
    await old.goBack() // replace 였으므로 옛 주소로 되돌아가지 않는다(앞 페이지로)
    pwExpect(old.url()).not.toContain(`/w/${slug}/`)
    await old.close()
    slug = renamed
  })

  it('not signed in: /w/<slug>/notes asks for the login, and signing in returns to that address', async () => {
    const guest = await browser.newContext({
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      viewport: { width: 1280, height: 800 },
    })
    guest.setDefaultTimeout(15_000)
    const page = await guest.newPage()
    try {
      await page.goto(`${baseUrl}/w/${slug}/notes`)
      await dismissConsent(page)
      await pwExpect(page).toHaveURL(/\/login$/)
      await fillSignIn(page, DEMO)
      await pwExpect(page).toHaveURL(new RegExp(`/w/${slug}/notes$`))
      await pwExpect(page.getByRole('link', { name: noteTitle })).toBeVisible()
    } finally {
      await guest.close()
    }
  })

  it('user removes the invitee: from their next request the team is gone from the list, its address and notes are 404', async () => {
    await user.goto(`${baseUrl}/w/${slug}/settings`)
    await user.getByRole('button', { name: /더보기$/ }).click()
    await user.getByRole('menuitem', { name: w.settings.removeAction }).click()
    await user
      .getByRole('dialog')
      .getByRole('button', { name: w.settings.removeDialog.confirm })
      .click()
    await pwExpect(user.getByRole('button', { name: /더보기$/ })).toHaveCount(0)

    // 그 사람의 다음 요청: 헤더는 서버가 검사한다 - 토큰에 팀이 실려 있지 않아 바로 막힌다
    const response = await fetch(`${apiUrl}/api/v1/notes`, {
      headers: { Authorization: `Bearer ${await tokenOf(invitee)}`, 'X-Workspace-Id': teamId },
    })
    pwExpect(response.status).toBe(404)

    await invitee.reload()
    await pwExpect(invitee.getByRole('heading', { name: w.notFound.title })).toBeVisible()
    await pwExpect(invitee.getByRole('link', { name: noteTitle })).toHaveCount(0)
    await invitee.getByRole('button', { name: /^워크스페이스 (고르기|바꾸기)/ }).click()
    await pwExpect(invitee.getByRole('menuitem', { name: teamName })).toHaveCount(0)
    await pwExpect(invitee.getByRole('menuitem', { name: w.switcher.create })).toBeVisible()
  })
})
