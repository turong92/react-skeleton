import { describe, expect, it } from 'vitest'
import { FAKE_CODE, FAKE_SOCIAL_REAUTH, createFakeAccountApi } from './fakeAccountApi'

const code = (error: unknown) => (error as { apiError: { code: string } }).apiError.code
const rejects = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('did not reject')
}

describe('fake account api: an account without an address on an app that requires one', () => {
  it('me says emailRequired; every call outside the allow list is 403 ACCOUNT.EMAIL_REQUIRED; the allow list answers', async () => {
    const api = createFakeAccountApi({ emailRequired: true })
    const me = await api.me()
    expect(me).toMatchObject({ email: null, emailRequired: true })
    expect(code(await rejects(api.identities()))).toBe('ACCOUNT.EMAIL_REQUIRED')
    expect(code(await rejects(api.updateProfile({ locale: 'ko' })))).toBe('ACCOUNT.EMAIL_REQUIRED')
    expect(await api.sessions()).toHaveLength(3) // /auth/** is on the allow list
  })

  it('first registration needs no re-authentication: address → code → emailRequired false, email set', async () => {
    const api = createFakeAccountApi({ emailRequired: true, codeWindowMinutes: 10 })
    const sent = await api.changeEmail({ newEmail: 'me@example.com' })
    expect(sent?.expiresAt).toBeTruthy()
    await api.confirmEmailChangeCode(FAKE_CODE)
    expect(await api.me()).toMatchObject({ email: 'me@example.com', emailRequired: false })
    expect(await api.identities()).toHaveLength(1) // no longer blocked
  })

  it('a wrong code counts down (CODE_INVALID attemptsLeft)', async () => {
    const api = createFakeAccountApi({ emailRequired: true })
    await api.changeEmail({ newEmail: 'me@example.com' })
    const error = await rejects(api.confirmEmailChangeCode('000000'))
    expect(code(error)).toBe('ACCOUNT.CODE_INVALID')
    expect((error as { apiError: { data: unknown } }).apiError.data).toEqual({ attemptsLeft: 4 })
  })

  it('an address another account owns answers the same 202 but no code ever works', async () => {
    const api = createFakeAccountApi({ emailRequired: true, takenEmails: ['taken@example.com'] })
    await expect(api.changeEmail({ newEmail: 'taken@example.com' })).resolves.not.toThrow()
    expect(code(await rejects(api.confirmEmailChangeCode(FAKE_CODE)))).toBe('ACCOUNT.CODE_INVALID')
    expect((await api.me()).emailRequired).toBe(true)
  })

  it('after the first-registration window the server wants the provider again (REAUTH_REQUIRED), then accepts the proof', async () => {
    const api = createFakeAccountApi({ emailRequired: true, reauthWindowExpired: true })
    expect(code(await rejects(api.changeEmail({ newEmail: 'me@example.com' })))).toBe(
      'ACCOUNT.REAUTH_REQUIRED',
    )
    await api.changeEmail({ newEmail: 'me@example.com', socialReauth: FAKE_SOCIAL_REAUTH })
    await api.confirmEmailChangeCode(FAKE_CODE)
    expect((await api.me()).emailRequired).toBe(false)
  })
})

describe('fake account api: contact email', () => {
  it('request → code → set; change; remove — me.contactEmail follows', async () => {
    const api = createFakeAccountApi({ contactEmail: 'old@example.com' })
    expect((await api.me()).contactEmail).toBe('old@example.com')
    await api.requestContactEmail('new@example.com')
    expect((await api.me()).contactEmail).toBe('old@example.com') // not yet
    expect(code(await rejects(api.confirmContactEmail('000000')))).toBe('ACCOUNT.CODE_INVALID')
    await api.confirmContactEmail(FAKE_CODE)
    expect((await api.me()).contactEmail).toBe('new@example.com')
    await api.removeContactEmail()
    expect((await api.me()).contactEmail).toBeNull()
  })

  it('a server with the feature off answers 404 and me.contactEmail stays null', async () => {
    const api = createFakeAccountApi({ contactEmailOff: true })
    expect(code(await rejects(api.requestContactEmail('x@example.com')))).toBe('COMMON.NOT_FOUND')
    expect((await api.me()).contactEmail).toBeNull()
  })
})
