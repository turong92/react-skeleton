import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { koPaymentLabels } from './labels'
import { SubscriptionPlanList } from './SubscriptionPlanList'
import type { SubscriptionPlan } from './subscriptionTypes'

/**
 * 구독 플랜 카드 목록 — 카드마다 이름 · 「3,900원 · 1개월마다 결제」 · 채운 「구독하기」 단추 하나(카드 한 장이 한 구역이라 단추도 카드마다 하나).
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
    await expect(canvas.getByText('6,900원 · 1개월마다 결제')).toBeVisible()
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

/** 한 상품의 월 · 연 플랜은 카드 한 장 - 주기 단추(누른 것이 채워진다)로 바꾸고, 행사 중이면 정가에 취소선 + 끝나는 날 */
const grouped: SubscriptionPlan[] = [
  {
    code: 'standard-month',
    name: 'Standard',
    amount: { amount: 6900, currency: 'KRW' },
    period: 'P1M',
    level: 2,
    productCode: 'standard',
  },
  {
    code: 'standard-year',
    name: 'Standard',
    amount: { amount: 59000, currency: 'KRW' },
    regularAmount: 69000,
    period: 'P1Y',
    level: 2,
    productCode: 'standard',
  },
]
export const MonthlyAndYearlyOnOneCard: Story = {
  args: {
    plans: grouped,
    saleEndsAtOf: (plan) => (plan.code === 'standard-year' ? '2026-11-30T12:00:00Z' : null),
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1)
    const monthly = canvas.getByRole('button', { name: '월간' })
    const yearly = canvas.getByRole('button', { name: '연간' })
    await expect(monthly).toHaveAttribute('aria-pressed', 'true')
    await expect(monthly).toHaveAttribute('data-variant', 'primary')
    await expect(yearly).toHaveAttribute('data-variant', 'secondary')
    await expect(canvas.getByText('6,900원 · 1개월마다 결제')).toBeVisible()
    await userEvent.click(yearly)
    await expect(yearly).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByText('69,000원').tagName).toBe('DEL')
    await expect(canvas.getByText('59,000원 · 1년마다 결제')).toBeVisible()
    await expect(canvas.getByText('2026. 11. 30.까지')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '구독하기: Standard' }))
    await expect(args.onSubscribe).toHaveBeenCalledWith(grouped[1])
  },
}

export const NoPlans: Story = {
  args: { plans: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('고를 수 있는 플랜이 없어요')).toBeVisible()
  },
}
