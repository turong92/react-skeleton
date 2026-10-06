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
})
