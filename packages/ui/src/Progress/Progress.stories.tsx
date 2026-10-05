import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Progress } from './Progress'

/** 진행률 막대 — 네이티브 `<progress>`(0~1). `label` 이 낭독 이름이고, 보이는 숫자는 `valueText`. 값이 없으면 끝을 모르는 진행(움직임 줄이기 설정을 따른다). */
const meta = {
  title: 'UI/Progress',
  component: Progress,
  args: { label: 'Uploading report.pdf', value: 0.42, valueText: '42%' },
} satisfies Meta<typeof Progress>
export default meta
type Story = StoryObj<typeof meta>

export const Determinate: Story = {
  play: async ({ canvas }) => {
    const bar = canvas.getByRole('progressbar', { name: 'Uploading report.pdf' })
    await expect(bar).toHaveAttribute('value', '0.42')
    await expect(canvas.getByText('42%')).toBeVisible()
  },
}

export const Indeterminate: Story = {
  args: { value: undefined, valueText: undefined, label: 'Preparing export' },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole('progressbar', { name: 'Preparing export' })
    await expect(bar).not.toHaveAttribute('value')
  },
}

export const Complete: Story = {
  args: { value: 1, valueText: '100%' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('progressbar')).toHaveAttribute('value', '1')
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('progressbar')).toBeVisible()
  },
}
