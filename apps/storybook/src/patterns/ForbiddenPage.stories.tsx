import { Button, EmptyState } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

/*
 * 권한 없음(403) 화면 틀 — 이유를 말하고 갈 곳을 준다. 로그인이 필요한 경우(401)는 이 화면이 아니라 `RequireAuth` 가 로그인으로 보낸다.
 * 복사해서 쓸 때: 라우트의 에러 상태에서 `isErrorCode(error, ErrorCodes.AUTH_FORBIDDEN)` 일 때 이 화면을 그린다.
 */
function ForbiddenPage({
  onHome,
  onSwitchAccount,
}: {
  onHome: () => void
  onSwitchAccount: () => void
}) {
  return (
    <>
      <h1>Access denied</h1>
      <EmptyState
        headingLevel={2}
        icon={<span>🔒</span>}
        title="You do not have permission to view this page"
        description="Ask an administrator of this workspace to give you access, or sign in with another account."
        action={
          <>
            <Button onClick={onHome}>Go to home</Button>{' '}
            <Button variant="secondary" onClick={onSwitchAccount}>
              Switch account
            </Button>
          </>
        }
      />
    </>
  )
}

const meta = {
  title: 'Patterns/Forbidden page',
  component: ForbiddenPage,
  args: { onHome: fn(), onSwitchAccount: fn() },
} satisfies Meta<typeof ForbiddenPage>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Go to home' }))
    await expect(args.onHome).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Switch account' }))
    await expect(args.onSwitchAccount).toHaveBeenCalledTimes(1)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: /permission/ })).toBeVisible()
  },
}
