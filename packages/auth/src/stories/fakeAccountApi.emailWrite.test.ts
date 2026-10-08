import { describe, expect, it } from 'vitest'
import { FAKE_CODE, createFakeAccountApi } from './fakeAccountApi'

const code = (error: unknown) => (error as { apiError: { code: string } }).apiError.code
const rejects = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('did not reject')
}

describe('fake account api: an app that asks for the address when writing (emailRequiredToWrite)', () => {
  it('me: emailRequired is there and false, emailRequiredToWrite is true, no address', async () => {
    const me = await createFakeAccountApi({ emailRequiredToWrite: true }).me()
    expect(me).toMatchObject({ email: null, emailRequired: false, emailRequiredToWrite: true })
  })

  it('reading passes; changes are 403 ACCOUNT.EMAIL_REQUIRED; the allow list (profile patch, sessions, email change) answers', async () => {
    const api = createFakeAccountApi({ emailRequiredToWrite: true })
    expect(await api.identities()).toHaveLength(1) // GET
    expect(code(await rejects(api.requestReauthConfirmation()))).toBe('ACCOUNT.EMAIL_REQUIRED')
    expect(code(await rejects(api.changePassword({ newPassword: 'x'.repeat(12) })))).toBe(
      'ACCOUNT.EMAIL_REQUIRED',
    )
    await expect(api.updateProfile({ locale: 'ko' })).resolves.toBeTruthy() // PATCH /account/me is allowed here
    expect(await api.sessions()).toHaveLength(3)
  })

  it('registering the address turns the flag off and leaves the key (true → false)', async () => {
    const api = createFakeAccountApi({ emailRequiredToWrite: true, codeWindowMinutes: 10 })
    await api.changeEmail({ newEmail: 'me@example.com' })
    await api.confirmEmailChangeCode(FAKE_CODE)
    expect(await api.me()).toMatchObject({
      email: 'me@example.com',
      emailRequired: false,
      emailRequiredToWrite: false,
    })
  })

  it('an old session needs the provider again, exactly as in the sign-in mode', async () => {
    const api = createFakeAccountApi({ emailRequiredToWrite: true, reauthWindowExpired: true })
    expect(code(await rejects(api.changeEmail({ newEmail: 'me@example.com' })))).toBe(
      'ACCOUNT.REAUTH_REQUIRED',
    )
  })

  it('discard works for the account without an address', async () => {
    await expect(
      createFakeAccountApi({ emailRequiredToWrite: true }).discardAccount(),
    ).resolves.not.toThrow()
  })

  it('a server without it has neither key (as before)', async () => {
    const me = await createFakeAccountApi().me()
    expect('emailRequiredToWrite' in me).toBe(false)
    expect('emailRequired' in me).toBe(false)
  })
})
