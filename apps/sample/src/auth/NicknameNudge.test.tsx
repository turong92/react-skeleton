import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { NicknameGateProvider } from './NicknameGate'
import { NicknameNudge } from './NicknameNudge'
import { myProfileKey } from './useMyProfile'

afterEach(async () => {
  await i18n.setLocale('ko', { remember: false })
})

const unused = async () => {
  throw new Error('unused')
}
const api: AuthApi = {
  login: unused,
  socialLogin: unused,
  me: unused,
  refresh: unused,
  logout: unused,
  magicLinkRequest: unused,
  methods: unused,
  magicLinkRedeem: unused,
  cancelDeletion: unused,
}

function render(profile: object | undefined) {
  const client = new QueryClient()
  if (profile) client.setQueryData(myProfileKey, profile)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <MemoryRouter>
          <NicknameGateProvider>
            <NicknameNudge />
          </NicknameGateProvider>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('NicknameNudge', () => {
  it('shows a conspicuous band with a filled primary button when the account has no nickname', () => {
    const html = render({ id: 'acc_1', displayName: null })
    expect(html).toContain('닉네임을 정해 주세요')
    expect(html).toMatch(/data-variant="primary"[^>]*>닉네임 정하기</)
    expect(html).toContain('aria-label="닉네임 안내"')
  })

  it('opens a dialog in place — a nickname field and a save button, no trip to the settings page', () => {
    const html = render({ id: 'acc_1', displayName: null })
    expect(html).toContain('<dialog')
    expect(html).toMatch(/<label[^>]*>[^<]*닉네임/)
    expect(html).not.toContain('href="/account#profile"')
  })

  it('stays out of the way once there is a nickname, and while the profile is unknown', () => {
    expect(render({ id: 'acc_1', displayName: '수민' })).not.toContain('닉네임을 정해 주세요')
    expect(render(undefined)).not.toContain('닉네임을 정해 주세요')
  })
})
