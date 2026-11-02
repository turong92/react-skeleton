import { readFileSync, writeFileSync } from 'node:fs'
import { nextStep, stepOf, totpAt } from './totp'

/*
 * 운영 계정(admin · moderator)의 2단계 인증 - 견본 백엔드는 운영 권한이 있는 계정에 2단계를 **필수**로 건다(`required-for: OPERATORS`).
 * 서버가 만든 DB 는 실행 때마다 새것이라 그 계정들은 등록 전이다: 전역 준비(`globalSetup`)가 한 번 등록해 **비밀을 파일에 보관**하고,
 * 파일(= 시험 파일마다 다른 프로세스)이 같은 비밀과 「마지막으로 쓴 걸음」을 나눠 쓴다. **비밀을 잃으면 다시 못 푼다** - 운영자는 자기 자신의 2단계를 해제할 수 없다(409)
 * 서버가 같은 걸음의 코드를 두 번 받지 않으므로 걸음은 늘 앞으로만 간다(`nextOperatorCode`).
 */

export const ADMIN_EMAIL = 'admin@example.com'
export const MODERATOR_EMAIL = process.env.E2E_MOD_EMAIL ?? 'moderator@example.com'
/** 시드 운영 계정 - 백엔드가 2단계를 요구하는 것만 등록된다 */
export const OPERATORS = [
  { email: ADMIN_EMAIL, password: 'password' },
  { email: MODERATOR_EMAIL, password: process.env.E2E_MOD_PASSWORD ?? 'password' },
]

type State = { secret: string; lastStep: number }
type Book = Record<string, State>
const readBook = (file: string): Book => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Book
  } catch {
    return {}
  }
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 이 계정은 보관된 비밀이 있다(= 로그인 때 코드를 내야 한다) */
export const hasOperatorSecret = (file: string, email: string) =>
  file !== '' && readBook(file)[email] !== undefined

/**
 * 다음에 쓸 6자리 코드 - 걸음을 정하고 파일에 적는 일은 한 번에(await 없이) 해서, 같은 프로세스의 동시 호출도 서로 다른 걸음을 받는다
 */
export async function nextOperatorCode(file: string, email: string): Promise<string> {
  const book = readBook(file)
  const state = book[email]
  if (!state) throw new Error(`no stored secret for ${email}`)
  const { step, waitMs } = nextStep(state.lastStep, Date.now())
  writeFileSync(file, JSON.stringify({ ...book, [email]: { ...state, lastStep: step } }))
  if (waitMs > 0) await sleep(waitMs + 250)
  return totpAt(state.secret, step)
}

type Json = { value?: Record<string, unknown>; code?: string }
const call = async (apiUrl: string, path: string, token: string | null, body?: unknown) => {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  return { status: response.status, json: (text ? JSON.parse(text) : {}) as Json }
}

const save = (file: string, email: string, state: State) =>
  writeFileSync(file, JSON.stringify({ ...readBook(file), [email]: state }))

/**
 * 운영 계정마다: 2단계가 필수인 백엔드면(`GET /auth/mfa` 의 `required`) 증거 없는 등록(로그인 15분 안의 면제)으로 켜고 비밀을 `file` 에 적는다. 필요 없으면(모듈이 없다 · 필수가 아니다 · 시드 계정이 없다) 건너뛴다. 하나라도 등록했으면 true.
 * 이미 켜진 백엔드(떠 있는 서버를 다시 쓴다)는 비밀을 `E2E_ADMIN_TOTP_SECRET`(admin) 으로 받아야 한다 - 없으면 던진다(비밀 없이는 로그인할 수 없다)
 */
export async function enrollOperators(
  apiUrl: string,
  file: string,
  accounts: Array<{ email: string; password: string }> = OPERATORS,
): Promise<boolean> {
  writeFileSync(file, '{}')
  let any = false
  for (const account of accounts) {
    const login = await call(apiUrl, '/auth/login', null, account)
    if (login.json.code === 'AUTH.MFA_REQUIRED') {
      const secret = account.email === ADMIN_EMAIL ? process.env.E2E_ADMIN_TOTP_SECRET : undefined
      if (!secret)
        throw new Error(
          `${account.email} already has two-step verification on (a reused backend?) - set E2E_ADMIN_TOTP_SECRET to the operator's secret`,
        )
      save(file, account.email, { secret, lastStep: stepOf(Date.now()) })
      any = true
      continue
    }
    if (login.status !== 200) continue // 이 백엔드에 없는 시드 계정
    const token = String(login.json.value?.accessToken)
    const status = await call(apiUrl, '/auth/mfa', token)
    if (status.status === 404 || status.json.value?.required !== true) continue
    const started = await call(apiUrl, '/auth/mfa/totp/enrollment', token, {})
    if (started.status !== 200) throw new Error(`${account.email} enrollment → ${started.status}`)
    const secret = String(started.json.value?.secret)
    const step = stepOf(Date.now())
    save(file, account.email, { secret, lastStep: step })
    const confirmed = await call(apiUrl, '/auth/mfa/totp/enrollment/confirm', token, {
      code: totpAt(secret, step),
    })
    if (confirmed.status !== 200)
      throw new Error(`${account.email} enrollment confirm → ${confirmed.status}`)
    any = true
  }
  return any
}
