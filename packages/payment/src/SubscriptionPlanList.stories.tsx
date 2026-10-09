import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { koPaymentLabels } from './labels'
import { SubscriptionPlanList } from './SubscriptionPlanList'
import type { SubscriptionPlan } from './subscriptionTypes'

/**
 * 구독 플랜 카드 목록 — 카드마다 이름 · 「3,900원 / 월」 · 채운 「구독하기」 단추 하나(카드 한 장이 한 구역이라 단추도 카드마다 하나).
 * 단추를 누르면 부모가 구독을 만들고 카드 등록 창을 연다. 여는 동안(`busyPlanCode`) 그 단추에 스피너가 돌고 다른 단추는 잠긴다.
 * 이름은 서버가 준 `name` 그대로다(앱이 번역하려면 바꿔 넘긴다). 375 · 320px 에서는 카드가 한 줄에 한 장으로 접힌다.
 */
const plans: SubscriptionPlan[] = [
  {
    code: 'basic',
    name: 'Basic',
    amount: { amount: 3900, currency: 'KRW' },
    period: 'P1M',
    level: 1,
  },
  {
    code: 'standard',
    name: 'Standard',
    amount: { amount: 6900, currency: 'KRW' },
    period: 'P1M',
    level: 2,
  },
  { code: 'pro', name: 'Pro', amount: { amount: 9900, currency: 'KRW' }, period: 'P1M', level: 3 },
]

const meta = {
  title: 'Packages/payment/SubscriptionPlanList',
  component: SubscriptionPlanList,
  args: { plans, onSubscribe: fn(), labels: koPaymentLabels, locale: 'ko-KR' },
} satisfies Meta<typeof SubscriptionPlanList>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getAllByRole('button', { name: /^구독하기/ })).toHaveLength(3)
    await expect(canvas.getByText('6,900원 / 월')).toBeVisible()
    const standard = canvas.getByRole('button', { name: '구독하기: Standard' })
    await expect(standard).toHaveAttribute('data-variant', 'primary')
    await userEvent.click(standard)
    await expect(args.onSubscribe).toHaveBeenCalledWith(plans[1])
  },
}

export const OpeningTheCardWindow: Story = {
  args: { busyPlanCode: 'standard' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Standard/ })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    await expect(canvas.getByRole('button', { name: '구독하기: Basic' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: '구독하기: Pro' })).toBeDisabled()
  },
}

export const NoPlans: Story = {
  args: { plans: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('고를 수 있는 플랜이 없어요')).toBeVisible()
  },
}
