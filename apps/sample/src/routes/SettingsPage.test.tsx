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
  it('leads with the nickname#tag and the email', () => {
    const html = render(me({ displayName: '수민', displayTag: '4821' }))
    expect(html).toContain('수민#4821')
    expect(html).toContain('sumin@example.com')
  })

  it('draws the account id nowhere — not in the text, not in an attribute, not behind a collapsed section', () => {
    const html = render(me({ displayName: '수민' }))
    expect(html).not.toContain('acc_317e90ab55d0aa11')
    expect(html).not.toContain('acc_317e')
    expect(html).not.toContain('문의용 정보')
    expect(html).not.toContain('계정 ID')
  })

  it('says the nickname is private and only seeds the first profile once — changing it later renames no profile', () => {
    const html = render(me({ displayName: '수민' }))
    expect(html).toContain('프로필 이름은 바뀌지 않아요')
  })

  it('without a nickname it says so and points at the account settings', () => {
    const html = render(me({ displayName: null }))
    expect(html).toContain('아직 정하지 않았어요')
    expect(html).toContain('href="/account#profile"')
  })
})

describe('SettingsPage — author profiles section', () => {
  it('has a profiles section other screens can link to (#profiles) that explains posts use a profile, not the account name', () => {
    const html = render(me({ displayName: '수민' }))
    expect(html).toMatch(/id="profiles"/)
    expect(html).toContain('글 · 댓글에 쓰는 프로필')
  })

  it('speaks English when the locale is en', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render(me({ displayName: 'Sumin' }))
    expect(html).toContain('Profiles for posts and comments')
    expect(html).toContain('does not rename any profile')
  })
})
