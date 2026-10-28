import { notificationKeys } from '@skeleton/notifications'
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

function render(profile: object | undefined, preferences?: object) {
  const client = new QueryClient()
  if (profile) client.setQueryData(myProfileKey, profile)
  if (preferences) client.setQueryData(notificationKeys.preferences(), preferences)
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
  it('shows the email and role, and no account nickname (the user has one concept: the nicknames below)', () => {
    const html = render(me({ displayName: '수민', displayTag: '4821' }))
    expect(html).toContain('sumin@example.com')
    expect(html).not.toContain('수민#4821')
    expect(html).not.toContain('수민')
    expect(html).not.toContain('나만 보는')
    expect(html).not.toContain('아직 정하지 않았어요')
    expect(html).not.toContain('href="/account#profile"')
  })

  it('draws the account id nowhere — not in the text, not in an attribute, not behind a collapsed section', () => {
    const html = render(me({ displayName: '수민' }))
    expect(html).not.toContain('acc_317e90ab55d0aa11')
    expect(html).not.toContain('acc_317e')
    expect(html).not.toContain('문의용 정보')
    expect(html).not.toContain('계정 ID')
  })

  it('leads to the account management with a boxed link card (not a bare line of text)', () => {
    const html = render(me({ displayName: null }))
    expect(html).toMatch(/<a [^>]*class="[^"]*card[^"]*"[^>]*href="\/account"/)
    expect(html).toContain('계정 관리')
    expect(html).toContain('비밀번호 · 이메일 · 로그인한 기기 · 삭제')
  })
})

describe('SettingsPage — notifications', () => {
  const prefs = {
    items: [
      { type: 'NOTE_UPDATED', muted: false },
      { type: 'comment.created', muted: false },
      { type: 'comment.replied', muted: true },
      { type: 'reward.granted', muted: false },
    ],
  }

  it('has a notifications card with one switch per type the server lists, named in Korean', () => {
    const html = render(me({}), prefs)
    expect(html).toContain('알림')
    for (const label of ['노트 수정', '댓글', '답글', '보상']) expect(html).toContain(`>${label}<`)
    expect(html.match(/role="switch"/g)).toHaveLength(4)
    expect(html).not.toContain('NOTE_UPDATED')
  })

  it('English labels', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render(me({}), prefs)
    for (const label of ['Note edits', 'Comments', 'Replies', 'Rewards'])
      expect(html).toContain(`>${label}<`)
  })
})

describe('SettingsPage — cheers', () => {
  it('has one boxed link line to 「내 응원 내역」 (a pressable card, not bare words)', () => {
    const html = render(me({}))
    expect(html).toMatch(/<a [^>]*class="[^"]*card[^"]*"[^>]*href="\/cheers"/)
    expect(html).toContain('내 응원 내역')
    expect(html).toContain('응원한 내역을 보고 환불을 요청해요')
  })

  it('English: My cheers', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render(me({}))
    expect(html).toMatch(/href="\/cheers"/)
    expect(html).toContain('My cheers')
  })
})

describe('SettingsPage — an account without an email address (Google with a non-Gmail address, LINE, X)', () => {
  it('says "no email" instead of a bare dash and offers a real button that adds one', () => {
    const html = render(me({ email: null, emailVerified: false }))
    expect(html).toContain('이메일 없음')
    expect(html).not.toContain('null')
    expect(html).toMatch(/<button[^>]*>[^<]*이메일 추가/)
  })

  it('an account with an address shows it and no add button', () => {
    const html = render(me({}))
    expect(html).toContain('sumin@example.com')
    expect(html).not.toContain('이메일 추가')
  })

  it('English: "No email" and "Add email"', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render(me({ email: null }))
    expect(html).toContain('No email')
    expect(html).toMatch(/<button[^>]*>[^<]*Add email/)
  })
})

describe('SettingsPage — two emails: the account email and where notices go', () => {
  it('names the account email as such and says notices go to it when no contact email is set', () => {
    const html = render(me({ contactEmail: null }))
    expect(html).toContain('계정 이메일')
    expect(html).toContain('연락받을 이메일')
    expect(html).toContain('계정 이메일로 받아요')
  })

  it('shows the contact email when there is one', () => {
    const html = render(me({ contactEmail: 'news@example.com' }))
    expect(html).toContain('news@example.com')
    expect(html).not.toContain('계정 이메일로 받아요')
  })

  it('draws no contact row for a server that does not know the feature (no key at all)', () => {
    const html = render(me({}))
    expect(html).not.toContain('연락받을 이메일')
  })

  it('English: Account email / Contact email', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render(me({ contactEmail: null }))
    expect(html).toContain('Account email')
    expect(html).toContain('Contact email')
    expect(html).toContain('Sent to your account email')
  })
})

describe('SettingsPage — nicknames section', () => {
  it("has one section for the nicknames used in posts and comments, in the user's word", () => {
    const html = render(me({ displayName: '수민' }))
    expect(html).toContain('내 닉네임')
    expect(html).toContain('게시판에 글과 댓글을 쓸 때 쓸 닉네임이에요.')
    expect(html).toContain('서로 다른 닉네임이 같은 사람이라는 건 다른 사람에게 보이지 않아요.')
    expect(html).not.toContain('프로필')
  })

  it('speaks English when the locale is en, with the same one word', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render(me({ displayName: 'Sumin' }))
    expect(html).toContain('My nicknames')
    expect(html).not.toMatch(/profile/i)
  })
})
