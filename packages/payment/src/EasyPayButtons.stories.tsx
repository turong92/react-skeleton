import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { EasyPayButtons } from './EasyPayButtons'
import { koPaymentLabels } from './labels'

/** 결제창 안 간편결제 단추 - 카드 단추(앱의 주된 결제 단추) 옆에 둔다. 목록은 `easyPaysFor(config, provider)`, 비면 아무것도 그리지 않는다. 단건 결제 전용. */
const meta = {
  title: 'Packages/payment/EasyPayButtons',
  component: EasyPayButtons,
  args: { codes: ['NAVERPAY', 'KAKAOPAY', 'TOSSPAY'], labels: koPaymentLabels, onPick: fn() },
} satisfies Meta<typeof EasyPayButtons>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args }) => {
    const buttons = canvas.getAllByRole('button')
    await expect(buttons.map((b) => b.textContent)).toEqual([
      '네이버페이',
      '카카오페이',
      '토스페이',
    ])
    await userEvent.click(canvas.getByRole('button', { name: '카카오페이' }))
    await expect(args.onPick).toHaveBeenCalledWith('KAKAOPAY')
  },
}

export const Opening: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole('button')) await expect(button).toBeDisabled()
  },
}

export const English: Story = {
  args: { labels: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: 'Easy pay' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Naver Pay' })).toBeInTheDocument()
  },
}
