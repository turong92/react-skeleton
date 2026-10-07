import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { myProfileKey } from '../auth/useMyProfile'
import { i18n } from '../i18n'
import { SettingsPage } from './SettingsPage'

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

const me = (over: object) => ({
  id: 'acc_317e90ab55d0aa11',
  email: 'sumin@example.com',
  emailVerified: true,
  displayName: null,
  roles: ['USER'],
  ...over,
})

function render(profile: object | undefined) {
  const client = new QueryClient()
  if (profile) client.setQueryData(myProfileKey, profile)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('SettingsPage — account card', () => {
  it('leads with the nickname#tag and the email, and keeps the account id out of the visible card', () => {
    const html = render(me({ displayName: '수민', displayTag: '4821' }))
    expect(html).toContain('수민#4821')
    expect(html).toContain('sumin@example.com')
    const visible = html.split('id="support-panel"')[0]
    expect(visible).not.toContain('acc_317e')
  })

  it('puts the account id inside the collapsed 「문의용 정보」 section with a copy button', () => {
    const html = render(me({ displayName: '수민' }))
    expect(html).toContain('문의용 정보')
    expect(html).toMatch(/id="support-panel"[^>]*hidden[^>]*>[\s\S]*acc_317e90ab55d0aa11/)
    expect(html).toContain('>복사<')
  })

  it('without a nickname it says so and points at the account settings', () => {
    const html = render(me({ displayName: null }))
    expect(html).toContain('아직 정하지 않았어요')
    expect(html).toContain('href="/account#profile"')
  })
})
