import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { koRewardsLabels } from '../labels'
import { createFakeRewards } from '../stories/fakeRewards'
import { WithQuery } from '../stories/WithQuery'
import { CouponWallet } from './CouponWallet'

/**
 * 쿠폰함 — 위에 코드 등록, 아래에 「사용 가능 / 사용·만료」 탭. 쿠폰 카드는 이름 · 혜택 한 줄(`stageSummary`) · 기한 · 최소 금액이고,
 * 쓸 수 없는 것은 상태 알약이 붙는다. 카드는 눌리지 않는다(쓰는 곳은 결제 화면의 `CouponPicker`).
 */
const meta = {
  title: 'Packages/rewards/CouponWallet',
  component: CouponWallet,
  parameters: { layout: 'padded' },
  args: { api: createFakeRewards().api, labels: koRewardsLabels, locale: 'ko-KR' },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof CouponWallet>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <CouponWallet {...args} api={createFakeRewards().api} />,
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('가입 환영 쿠폰')).toBeVisible()
    await expect(canvas.getByText('30% 할인 (최대 5,000원)')).toBeVisible()
    await expect(canvas.getByText('첫 1회 무료, 이후 3회 50%')).toBeVisible()
    await expect(canvas.getByText('10,000원 이상 결제할 때', { exact: false })).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: '사용·만료' }))
    await expect(await canvas.findByText('지난 가을 쿠폰')).toBeVisible()
    await expect(canvas.getByText('만료됨')).toBeVisible()
    await expect(canvas.getByText('사용함')).toBeVisible()
  },
}

export const Empty: Story = {
  render: (args) => <CouponWallet {...args} api={createFakeRewards({ emptyCoupons: true }).api} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('쓸 수 있는 쿠폰이 없어요.')).toBeVisible()
  },
}

export const RedeemCode: Story = {
  render: (args) => <CouponWallet {...args} api={createFakeRewards().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('쿠폰 코드'), 'SPRING')
    await userEvent.click(canvas.getByRole('button', { name: '쿠폰 등록' }))
    await expect(await canvas.findByText('쿠폰을 담았어요.')).toBeVisible()
    await expect(await canvas.findByText('코드 SPRING 쿠폰')).toBeVisible()
  },
}

export const RedeemWrongCode: Story = {
  render: (args) => <CouponWallet {...args} api={createFakeRewards().api} />,
  play: async ({ canvas, userEvent }) => {
    const input = await canvas.findByLabelText('쿠폰 코드')
    await userEvent.type(input, 'BAD')
    await userEvent.click(canvas.getByRole('button', { name: '쿠폰 등록' }))
    await expect(await canvas.findByText('맞지 않는 코드예요.')).toBeVisible()
    await expect(input).toBeInvalid()
    await userEvent.clear(input)
    await userEvent.type(input, 'USED')
    await userEvent.click(canvas.getByRole('button', { name: '쿠폰 등록' }))
    await expect(await canvas.findByText('이미 사용한 코드예요.')).toBeVisible()
  },
}
