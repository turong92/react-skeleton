import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koPaymentLabels } from './labels'
import { TestModeNotice } from './TestModeNotice'

/** 「테스트 결제예요. 실제로 돈이 나가지 않아요」 — `testMode` 면 결제 단추 가까이와 결과 화면에 늘 보인다(사라지지 않는 안내 띠). */
const meta = {
  title: 'Packages/payment/TestModeNotice',
  component: TestModeNotice,
  args: { labels: koPaymentLabels },
} satisfies Meta<typeof TestModeNotice>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent(
      '테스트 결제예요. 실제로 돈이 나가지 않아요',
    )
  },
}

export const English: Story = {
  args: { labels: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('This is a test payment')
  },
}
