import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Spinner } from './Spinner'

/** 기다리는 중 표시. 화면에는 고리만 보이고 낭독기에는 `label`(기본 `Loading`)이 `role="status"` 로 읽힌다. 버튼 안에서는 `<Button loading>` 이 쓴다. */
const meta = { title: 'UI/Spinner', component: Spinner } satisfies Meta<typeof Spinner>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading')
  },
}

export const CustomLabel: Story = {
  args: { label: 'Loading projects' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading projects')
  },
}
