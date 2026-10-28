import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { sampleCoupons } from '../stories/fakeRewards'
import { CouponPicker } from './CouponPicker'

/**
 * 결제 때 쿠폰 고르기 — 「쿠폰 쓰지 않기」 와 쿠폰 목록(하나만 고른다), 고르면 할인 전 → 후 금액(`preview`).
 * 견적은 결제 패키지의 `quote` 응답에서 앱이 `{ originalAmount, amount, currency }` 로 옮겨 준다 — 두 패키지는 서로 import 하지 않는다.
 * 최소 결제 금액에 못 미치는 쿠폰은 이유를 보이되 막지는 않는다(서버가 판정한다 — `PAYMENT.DISCOUNT_BELOW_MINIMUM`).
 */
const meta = {
  title: 'Packages/rewards/CouponPicker',
  component: CouponPicker,
  parameters: { layout: 'padded' },
  args: {
    coupons: sampleCoupons,
    selectedId: null,
    onSelect: () => {},
    labels: koRewardsLabels,
    locale: 'ko-KR',
  },
} satisfies Meta<typeof CouponPicker>
export default meta
type Story = StoryObj<typeof meta>

function Demo(args: Parameters<typeof CouponPicker>[0]) {
  const [selected, setSelected] = useState<string | null>(args.selectedId)
  return (
    <CouponPicker
      {...args}
      selectedId={selected}
      onSelect={setSelected}
      preview={
        selected === 'c1'
          ? { originalAmount: 12000, amount: 8400, currency: 'KRW' }
          : { originalAmount: 12000, amount: 12000, currency: 'KRW' }
      }
    />
  )
}

export const Default: Story = {
  render: (args) => <Demo {...args} />,
  play: async ({ canvas, userEvent }) => {
    const none = canvas.getByRole('radio', { name: '쿠폰 쓰지 않기' })
    await expect(none).toBeChecked()
    await expect(canvas.queryByText('결제 금액')).toBeNull()
    await userEvent.click(canvas.getByRole('radio', { name: /가입 환영 쿠폰/ }))
    await expect(canvas.getByRole('radio', { name: /가입 환영 쿠폰/ })).toBeChecked()
    await expect(canvas.getByText('8,400원')).toBeVisible()
    await expect(canvas.getByText('12,000원')).toBeVisible()
    await userEvent.click(none)
    await expect(canvas.queryByText('결제 금액')).toBeNull()
  },
}

export const BelowMinimum: Story = {
  args: { orderAmount: 8000 },
  render: (args) => <Demo {...args} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('10,000원 이상 결제할 때만 쓸 수 있어요')).toBeVisible()
  },
}
