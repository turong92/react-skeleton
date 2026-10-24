import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect } from 'storybook/test'
import { AuthProvider } from './AuthProvider'
import { RequirePermission } from './RequirePermission'
import { createAuthSession } from './session'
import { createFakeAuthApi } from './stories/fakeAuthApi'
import { createTokenStore } from './tokenStore'

/**
 * 권한 가드. 로그인한 사람 중 `anyOf` 권한(전권 `*` 포함)이 하나라도 있는 사람만 아래 라우트를 본다.
 * 로그인 안 함 → `redirectTo`(기본 `/login`), 권한 없음 → 로그아웃시키지 않고 「접근 차단」 안내. 화면을 숨길 뿐이고 진짜 판정은 서버가 한다.
 * 권한은 백엔드 `GET /auth/me` 의 `permissions` - 레이아웃 라우트의 `element: <RequirePermission anyOf={['payment.read']} />` 로 쓴다.
 */
function Demo({ permissions, anyOf }: { permissions: string[] | null; anyOf: string[] }) {
  const session = useMemo(() => {
    const created = createAuthSession({ api: createFakeAuthApi(), store: createTokenStore() })
    if (permissions)
      created.signIn({
        accessToken: 'story-token',
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z',
        principal: { accountId: 'acct-cs', roles: ['CS'], permissions },
      })
    return created
  }, [permissions])
  return (
    <AuthProvider session={session}>
      <MemoryRouter initialEntries={['/payments']}>
        <Routes>
          <Route element={<RequirePermission anyOf={anyOf} />}>
            <Route path="/payments" element={<h2>Payments page</h2>} />
          </Route>
          <Route path="/login" element={<h2>Login page</h2>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

const meta = {
  title: 'Packages/auth/RequirePermission',
  component: RequirePermission,
} satisfies Meta<typeof RequirePermission>
export default meta
type Story = StoryObj<typeof meta>

export const HasThePermission: Story = {
  args: { anyOf: ['payment.read'] },
  render: () => <Demo permissions={['payment.read', 'payment.refund']} anyOf={['payment.read']} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Payments page' })).toBeVisible()
  },
}

export const AllPermissionsPass: Story = {
  args: { anyOf: ['payment.read'] },
  render: () => <Demo permissions={['*']} anyOf={['payment.read']} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Payments page' })).toBeVisible()
  },
}

export const WithoutItShowsTheBlockedNotice: Story = {
  args: { anyOf: ['payment.read'] },
  render: () => <Demo permissions={['board.moderate']} anyOf={['payment.read']} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Access blocked')).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Payments page' })).toBeNull()
  },
}

export const AnonymousIsSentToLogin: Story = {
  args: { anyOf: ['payment.read'] },
  render: () => <Demo permissions={null} anyOf={['payment.read']} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Login page' })).toBeVisible()
  },
}
