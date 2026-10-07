import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { authorProfileKeys } from '@skeleton/author-profile'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useAuthorPicker } from './useAuthorPicker'

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

function Slot({ mustCreate }: { mustCreate: boolean }) {
  const picker = useAuthorPicker('general', { mustCreate, open: () => undefined })
  return picker({
    value: undefined,
    onChange: () => undefined,
    threadAuthorId: undefined,
    threadLoading: false,
    invalid: false,
    disabled: false,
    onUnsettledChange: () => undefined,
  })
}

function render(mustCreate: boolean) {
  const client = new QueryClient()
  client.setQueryData(authorProfileKeys.list(), [named])
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AuthProvider session={createAuthSession({ api, store: createTokenStore() })}>
        <Slot mustCreate={mustCreate} />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('the board author picker of the sample', () => {
  it('with no named profile it offers only "프로필 만들기" (it opens the gate dialog) — no list to choose from', () => {
    const html = render(true)
    expect(html).toContain('프로필 만들기')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('aria-haspopup="menu"')
    expect(html).not.toContain('Ann')
  })

  it('with a named profile it is the real picker: a menu button, no create button', () => {
    const html = render(false)
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).not.toContain('프로필 만들기')
  })

  it('source guard — the post page hands the board no `beforeWrite` (the board would run it for comment edits too)', () => {
    const page = readFileSync(new URL('../routes/BoardPostPage.tsx', import.meta.url), 'utf8')
    expect(page).not.toContain('beforeWrite')
  })
})
