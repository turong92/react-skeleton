import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { SwitcherDemo } from './stories/Demos'

/**
 * 머리줄의 팀 고르기 — 지금 팀 이름이 보이는 단추 하나. 누르면 내 팀 목록(지금 팀에 ✓)과 「새 워크스페이스」.
 * 이동은 앱이 한다: 고른 팀은 `onSelect(workspace)` 로, 주소 `/w/<slug>/…` 로 보내는 것은 앱의 라우터가 맡는다
 */
const meta = {
  title: 'Packages/workspace/WorkspaceSwitcher',
  component: SwitcherDemo,
  parameters: { layout: 'padded' },
  args: { currentSlug: 'acme' },
} satisfies Meta<typeof SwitcherDemo>
export default meta
type Story = StoryObj<typeof meta>

export const ShowsTheCurrentTeam: Story = {
  play: async ({ canvas }) => {
    const trigger = await canvas.findByRole('button', { name: /지금: Acme/ })
    await expect(trigger).toHaveTextContent('Acme')
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  },
}

export const PicksAnotherTeam: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /지금: Acme/ }))
    await expect(await canvas.findByRole('menuitemradio', { name: 'Acme' })).toBeChecked()
    await userEvent.click(canvas.getByRole('menuitemradio', { name: 'Globex' }))
    await expect(await canvas.findByRole('status', { name: 'log' })).toHaveTextContent(
      'select:globex',
    )
  },
}

export const OffersANewWorkspace: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /지금: Acme/ }))
    await userEvent.click(await canvas.findByRole('menuitem', { name: '새 워크스페이스' }))
    await expect(await canvas.findByRole('status', { name: 'log' })).toHaveTextContent('create')
  },
}

export const NoTeamInTheAddressYet: Story = {
  args: { currentSlug: undefined },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: '워크스페이스 고르기' })).toBeEnabled()
  },
}
