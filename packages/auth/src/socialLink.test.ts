import { describe, expect, it, vi } from 'vitest'
import type { AccountApi } from './account/accountApi'
import { createSocialLinkFlow } from './socialLink'

const providers = {
  google: { clientId: 'cid', redirectUri: 'https://app.example.com/account/link-callback' },
}

describe('createSocialLinkFlow (logged-in user adds a provider to the account)', () => {
  it('start builds the authorize url with a state kept apart from the sign-in flow', () => {
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial: vi.fn() },
      createState: () => 'state-1',
    })
    const { url, state } = flow.start('google')
    expect(state).toBe('state-1')
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(providers.google.redirectUri)
  })

  it('complete sends the code to POST /account/identities/social/{provider}, never to a login', async () => {
    const linkSocial = vi.fn(async () => ({
      id: 'idn_9',
      method: 'google',
      subject: null,
      verified: true,
      createdAt: 't',
      lastUsedAt: null,
      removable: true,
    }))
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial } as Pick<AccountApi, 'linkSocial'>,
      createState: () => 's',
    })
    flow.start('google')
    const result = await flow.complete('?code=abc&state=s')
    expect(linkSocial).toHaveBeenCalledWith('google', 'abc', providers.google.redirectUri)
    expect(result.provider).toBe('google')
  })

  it('a callback this browser did not start is refused before any request', async () => {
    const linkSocial = vi.fn()
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    await expect(flow.complete('?code=abc&state=other')).rejects.toMatchObject({
      reason: 'state_mismatch',
    })
    expect(linkSocial).not.toHaveBeenCalled()
  })

  it('a callback without state is refused (login CSRF / forced linking)', async () => {
    const linkSocial = vi.fn()
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    flow.start('google')
    await expect(flow.complete('?code=abc')).rejects.toMatchObject({ reason: 'state_mismatch' })
    expect(linkSocial).not.toHaveBeenCalled()
  })

  it('state is single use: a replayed callback after completion is refused and links once', async () => {
    const linkSocial = vi.fn(async () => ({}) as never)
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    flow.start('google')
    await flow.complete('?code=abc&state=s')
    await expect(flow.complete('?code=abc&state=s')).resolves.toBeDefined() // same in-flight result, no second request
    expect(linkSocial).toHaveBeenCalledTimes(1)
  })

  it('state is bound to the browser storage it was started in', async () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
    const linkSocial = vi.fn(async () => ({}) as never)
    createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      storage,
      createState: () => 's',
    }).start('google')
    const other = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    }) // another browser: empty storage
    await expect(other.complete('?code=abc&state=s')).rejects.toMatchObject({
      reason: 'state_mismatch',
    })
    const same = createSocialLinkFlow({ providers, accountApi: { linkSocial }, storage })
    await same.complete('?code=abc&state=s')
    expect(linkSocial).toHaveBeenCalledTimes(1)
  })

  it('read checks state and hands back the code without linking (the page asks for the password first)', async () => {
    const linkSocial = vi.fn(async () => ({}) as never)
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    flow.start('google')
    const first = await flow.read('?code=abc&state=s')
    expect(first).toEqual({
      provider: 'google',
      authorizationCode: 'abc',
      redirectUri: providers.google.redirectUri,
    })
    expect(await flow.read('?code=abc&state=s')).toEqual(first) // a double effect reads the same result
    expect(linkSocial).not.toHaveBeenCalled()
    await expect(flow.read('?code=abc&state=other')).rejects.toMatchObject({
      reason: 'state_mismatch',
    })
  })

  it('complete carries the re-authentication credential to the server call', async () => {
    const linkSocial = vi.fn(async () => ({}) as never)
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    flow.start('google')
    await flow.complete('?code=abc&state=s', { confirmationToken: 'rt' })
    expect(linkSocial).toHaveBeenCalledWith('google', 'abc', providers.google.redirectUri, {
      confirmationToken: 'rt',
    })
  })
})
