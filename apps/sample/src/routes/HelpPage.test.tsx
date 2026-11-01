import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { HelpPage } from './HelpPage'

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

const render = () =>
  renderToStaticMarkup(
    <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <HelpPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthProvider>,
  )

describe('HelpPage — 도움말', () => {
  const html = render()

  it('shows the app’s own questions folded, then the contact form', () => {
    expect(html).toContain('노트는 어떻게 쓰나요?')
    expect(html.match(/<details/g)).toHaveLength(4)
    expect(html).not.toContain('<details open')
    expect(html.indexOf('노트는 어떻게 쓰나요?')).toBeLessThan(html.indexOf('문의하기'))
    expect(html).toContain('type="submit"')
  })

  it('asks the signed-out visitor for no human check when the build has no Turnstile site key', () => {
    expect(html).not.toContain('cf-turnstile')
    expect(html).toContain('적어 주신 내용과 이메일은 문의에 답하는 데만 쓰여요.')
  })
})
