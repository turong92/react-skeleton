import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { Tooltip } from './Tooltip'

/**
 * 도움말 말풍선 — WAI-ARIA tooltip. 트리거는 `aria-describedby` 로 이어지고, 포커스하면 바로 · 마우스를 올리면 잠시 뒤 보이며 Esc 로 닫는다.
 * 터치에는 없으니 말풍선이 유일한 안내이면 안 된다(중요한 말은 `Field` 의 `hint`). 아이콘 버튼처럼 이름이 짧은 트리거에.
 */
const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  args: {
    content: 'Copies a link to this note',
    delayMs: 50,
    children: (aria) => (
      <button type="button" {...aria}>
        Share
      </button>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 'var(--space-3xl)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>
export default meta
type Story = StoryObj<typeof meta>

export const ShowsOnFocusAndClosesOnEscape: Story = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Share' })
    await expect(button).toHaveAccessibleDescription('Copies a link to this note')
    await expect(canvas.getByRole('tooltip', { hidden: true })).not.toBeVisible()
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await expect(canvas.getByRole('tooltip')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(canvas.getByRole('tooltip', { hidden: true })).not.toBeVisible()
  },
}

export const ShowsOnHover: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(canvas.getByRole('tooltip')).toBeVisible())
    await userEvent.unhover(canvas.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(canvas.getByRole('tooltip', { hidden: true })).not.toBeVisible())
  },
}

export const Bottom: Story = {
  args: { placement: 'bottom' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(canvas.getByRole('tooltip')).toHaveAttribute('data-placement', 'bottom')
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab()
    await expect(canvas.getByRole('tooltip')).toBeVisible()
  },
}
