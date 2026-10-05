import type { Meta, StoryObj } from '@storybook/react-vite'
import { toast } from 'sonner'
import { expect, screen } from 'storybook/test'
import { Button } from '@skeleton/ui'
import { setTheme } from './theme'
import { ThemedToaster } from './ThemedToaster'

/** sonner 토스트도 고른 테마를 따른다. 앱 루트에 한 번 둔다(`<ThemedToaster />`), 토스트는 어디서든 `toast(...)` / `showApiError` 로 띄운다. */
const meta = {
  title: 'Packages/theme/ThemedToaster',
  component: ThemedToaster,
  parameters: { a11y: { test: 'error' } },
  beforeEach: () => {
    setTheme('dark')
    return () => setTheme('system')
  },
  render: () => (
    <>
      <Button onClick={() => toast.success('Saved')}>Notify</Button>
      <ThemedToaster />
    </>
  ),
} satisfies Meta<typeof ThemedToaster>
export default meta
type Story = StoryObj<typeof meta>

export const FollowsTheTheme: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Notify' }))
    await expect(await screen.findByText('Saved')).toBeInTheDocument()
    await expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute(
      'data-sonner-theme',
      'dark',
    )
  },
}
