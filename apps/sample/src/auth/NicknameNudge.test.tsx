import { authorProfileKeys } from '@skeleton/author-profile'
import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { NicknameGateProvider } from './NicknameGate'
import { NicknameNudge } from './NicknameNudge'

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

const named = { id: 'prf_a', name: 'Ann', tag: '0001', createdAt: '2026-10-01T00:00:00Z' }
const unnamed = { id: 'prf_u', name: null, tag: null, createdAt: '2026-10-01T00:00:00Z' }

/** `profiles` — 서버가 준 작성 닉네임 목록(없으면 아직 모른다) */
function render(profiles: readonly object[] | undefined) {
  const client = new QueryClient()
  if (profiles) client.setQueryData(authorProfileKeys.list(), profiles)
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

describe('NicknameNudge — only when every nickname is still unnamed (magic-link sign-up …)', () => {
  it('shows one conspicuous band: a title, one sentence, one filled primary button and a later button', () => {
    const html = render([unnamed])
    expect(html).toContain('닉네임을 정해 주세요')
    expect(html).toContain('닉네임이 없으면 게시판에서 「이름 없는 사용자」로 보여요.')
    expect(html).toMatch(/data-variant="primary"[^>]*>닉네임 정하기</)
    expect(html).toMatch(/>나중에</)
    expect(html).toContain('aria-label="닉네임 안내"')
  })

  it('has no second way in — no link to settings, no secondary button, no word 「프로필」 and no account-name talk', () => {
    const html = render([unnamed])
    expect(html).not.toContain('data-variant="secondary"')
    expect(html).not.toContain('href="/settings')
    expect(html).not.toContain('href="/account')
    expect(html).not.toContain('프로필')
    expect(html).not.toContain('계정 이름')
    expect(html).not.toContain('프로필 이름 정하기')
  })

  it('opens a dialog in place (the same one the write gate opens), not a trip to another page', () => {
    const html = render([unnamed])
    expect(html).toContain('<dialog')
  })

  it('speaks English with the same one word', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = render([unnamed])
    expect(html).toContain('Choose a nickname')
    expect(html).toMatch(/data-variant="primary"[^>]*>Choose a nickname</)
    expect(html).not.toMatch(/profile/i)
  })

  it('stays out of the way once any nickname has a name, and while the list is unknown', () => {
    expect(render([named])).not.toContain('닉네임을 정해 주세요</strong>')
    expect(render([unnamed, named])).not.toContain('닉네임을 정해 주세요</strong>')
    expect(render(undefined)).not.toContain('닉네임을 정해 주세요</strong>')
  })
})
