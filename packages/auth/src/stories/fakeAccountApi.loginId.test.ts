import { describe, expect, it } from 'vitest'
import { FAKE_CODE, createFakeAccountApi } from './fakeAccountApi'

const code = (error: unknown) => (error as { apiError: { code: string } }).apiError.code
const fieldCode = (error: unknown) =>
  (error as { apiError: { errors?: Array<{ field: string; code: string }> } }).apiError.errors?.[0]
const rejects = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('did not reject')
}

describe('fake account api: a server without the login id feature (the default — as it is today)', () => {
  it('me has no loginId key; the three calls answer 404', async () => {
    const api = createFakeAccountApi()
    expect('loginId' in (await api.me())).toBe(false)
    for (const call of [
      () => api.checkLoginId('sumin.kim'),
      () => api.setLoginId('sumin.kim'),
      () => api.forgotLoginId('a@x.y'),
    ])
      expect(code(await rejects(call()))).toBe('COMMON.NOT_FOUND')
  })
})

describe('fake account api: login id on, an account that has not chosen one yet', () => {
  const make = () => createFakeAccountApi({ loginId: { taken: ['taken.one'] } })

  it('me says loginId null; calls outside the allow list are 403 ACCOUNT.LOGIN_ID_REQUIRED, the allow list answers', async () => {
    const api = make()
    expect((await api.me()).loginId).toBeNull()
    expect(code(await rejects(api.identities()))).toBe('ACCOUNT.LOGIN_ID_REQUIRED')
    expect(code(await rejects(api.updateProfile({ locale: 'ko' })))).toBe(
      'ACCOUNT.LOGIN_ID_REQUIRED',
    )
    expect(await api.sessions()).toHaveLength(3) // /auth/** is on the allow list
    await expect(api.checkLoginId('free.name')).resolves.toBeTruthy() // and so is the check
  })

  it('checkLoginId: normalizes, and answers available · TAKEN · INVALID with the code', async () => {
    const api = make()
    expect(await api.checkLoginId(' Free.Name ')).toEqual({
      normalized: 'free.name',
      available: true,
    })
    expect(await api.checkLoginId('Taken.One')).toEqual({
      normalized: 'taken.one',
      available: false,
      reason: 'TAKEN',
    })
    expect(await api.checkLoginId('ab')).toEqual({
      normalized: 'ab',
      available: false,
      reason: 'INVALID',
      code: 'Size',
    })
    expect(await api.checkLoginId('a b c d')).toMatchObject({ reason: 'INVALID', code: 'Pattern' })
    expect(await api.checkLoginId('')).toMatchObject({ reason: 'INVALID', code: 'Required' })
  })

  it('setLoginId: a format error is a 400 on the loginId field, a used one 409 LOGIN_ID_TAKEN', async () => {
    const api = make()
    expect(fieldCode(await rejects(api.setLoginId('ab')))).toEqual({
      field: 'loginId',
      code: 'Size',
      message: expect.any(String),
    })
    expect(code(await rejects(api.setLoginId('Taken.One')))).toBe('ACCOUNT.LOGIN_ID_TAKEN')
  })

  it('setLoginId stores the normalized id and answers the me body; the gate lifts; a second call is 409 ALREADY_SET', async () => {
    const api = make()
    const me = await api.setLoginId('Sumin.Kim')
    expect(me.loginId).toBe('sumin.kim')
    expect((await api.me()).loginId).toBe('sumin.kim')
    await expect(api.identities()).resolves.toBeTruthy()
    expect(code(await rejects(api.setLoginId('other.name')))).toBe('ACCOUNT.LOGIN_ID_ALREADY_SET')
    expect((await api.checkLoginId('sumin.kim')).available).toBe(false) // now used (by this account)
  })

  it('the gate comes before the email gate (login id → email)', async () => {
    const api = createFakeAccountApi({ emailRequired: true, loginId: {} })
    expect(code(await rejects(api.identities()))).toBe('ACCOUNT.LOGIN_ID_REQUIRED')
    await api.setLoginId('sumin.kim')
    expect(code(await rejects(api.identities()))).toBe('ACCOUNT.EMAIL_REQUIRED')
  })

  it('forgotLoginId always answers (existence is hidden) and is recorded', async () => {
    const api = make()
    await expect(api.forgotLoginId('nobody@example.com')).resolves.toBeUndefined()
    expect(api.calls).toContain('forgotLoginId')
  })
})

describe('fake account api: an account that already has a login id', () => {
  it('me carries it, the gate is open, setLoginId is 409 ALREADY_SET', async () => {
    const api = createFakeAccountApi({ loginId: { value: 'Ann.Lee' } })
    expect((await api.me()).loginId).toBe('ann.lee')
    await expect(api.identities()).resolves.toBeTruthy()
    expect(code(await rejects(api.setLoginId('other.name')))).toBe('ACCOUNT.LOGIN_ID_ALREADY_SET')
  })
})

describe('fake account api: sign-up with a login id', () => {
  const request = (loginId?: string) => ({
    email: 'ann@example.com',
    password: 'Correct-horse-9',
    ...(loginId ? { loginId } : {}),
  })

  it('a used id is 409 LOGIN_ID_TAKEN at once; a bad format is a 400 on the loginId field', async () => {
    const api = createFakeAccountApi({ loginId: { taken: ['taken.one'] } })
    expect(code(await rejects(api.signUp(request('taken.one'))))).toBe('ACCOUNT.LOGIN_ID_TAKEN')
    expect(fieldCode(await rejects(api.signUp(request('x'))))).toMatchObject({
      field: 'loginId',
      code: 'Size',
    })
    await expect(api.signUp(request('free.name'))).resolves.toMatchObject({ signUpId: 'sid-1' })
  })

  it('an id that goes to someone else meanwhile: the code step answers 409 and the same code works with another id', async () => {
    const api = createFakeAccountApi({ loginId: { takenOnConfirm: ['late.one'] } })
    await api.signUp(request('late.one'))
    expect(code(await rejects(api.verifySignUpCode('sid-1', FAKE_CODE)))).toBe(
      'ACCOUNT.LOGIN_ID_TAKEN',
    )
    const tokens = await api.verifySignUpCode('sid-1', FAKE_CODE, { loginId: 'fresh.one' })
    expect(tokens.accessToken).toBeTruthy()
  })

  it('a server without the feature ignores the field, as the real one does', async () => {
    const api = createFakeAccountApi()
    await expect(api.signUp(request('taken.one'))).resolves.toMatchObject({ signUpId: 'sid-1' })
  })
})
