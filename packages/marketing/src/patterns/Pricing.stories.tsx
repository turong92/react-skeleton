import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'
// 복사해 쓸 때: 아래 한 줄을 `from '@skeleton/marketing'` 으로
import { FaqAccordion, PricingTable, type BillingInterval, type PricingPlan } from '../index'

/**
 * 요금제 페이지 — 제목 + 월/연 토글 + 요금제 카드(강조 · 0원 · 문의) + 결제 관련 질문. 복사해서 `plans` 데이터와 `onSelect`(가입 · 결제 · 문의로 이동)만 바꾼다.
 * 금액의 통화 · 로케일은 명시한다(서버 렌더와 같아야 하니). 결제 연동(`@skeleton/payment`)은 `onSelect` 안에서 — 이 화면은 결제를 모른다.
 */
const meta = {
  title: 'Patterns/Pricing',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For trying things out',
    price: { monthly: 0, yearly: 0 },
    features: ['1 project', '100 notes'],
    ctaLabel: 'Start free',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For people who write daily',
    price: { monthly: 10, yearly: 96 },
    features: ['Unlimited projects', 'Attachments up to 1 GB', 'Priority support'],
    ctaLabel: 'Choose Pro',
    highlighted: true,
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For teams that share',
    price: { monthly: 25, yearly: 240 },
    features: ['Everything in Pro', 'Shared workspaces'],
    ctaLabel: 'Choose Team',
  },
  {
    id: 'ent',
    name: 'Enterprise',
    description: 'For organisations',
    price: null,
    features: ['SSO', 'Audit log', 'Dedicated support'],
    ctaLabel: 'Contact sales',
  },
]
const onSelect = fn()

function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  return (
    <div
      style={{
        maxWidth: '72rem',
        margin: '0 auto',
        padding: 'var(--space-2xl) var(--space-lg)',
        display: 'grid',
        gap: 'var(--space-3xl)',
      }}
    >
      <PricingTable
        headingLevel={2}
        title="Pricing that grows with you"
        subtitle="Every plan starts with a 14-day trial of Pro."
        currency="USD"
        locale="en-US"
        interval={interval}
        onIntervalChange={setInterval}
        onSelect={onSelect}
        plans={plans}
      />
      <FaqAccordion
        title="Billing questions"
        items={[
          {
            id: 'switch',
            question: 'Can I switch between monthly and yearly?',
            answer: <p>Yes — the change applies from your next renewal.</p>,
          },
          {
            id: 'refund',
            question: 'What about refunds?',
            answer: <p>Within 14 days of a purchase, no questions asked.</p>,
          },
        ]}
      />
    </div>
  )
}

export const Default: Story = {
  render: () => <PricingPage />,
  beforeEach: () => onSelect.mockClear(),
  play: async ({ canvas, userEvent }) => {
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Pricing that grows with you' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /Yearly/ }))
    await expect(canvas.getByText('$20')).toBeVisible() // Team 240 / 12
    await userEvent.click(canvas.getByRole('button', { name: 'Choose Team' }))
    await expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'team' }), 'yearly')
    await userEvent.click(canvas.getByRole('button', { name: 'Contact sales' }))
    await expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ent' }),
      'yearly',
    )
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => <PricingPage />,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('article')).toHaveLength(4)
  },
}
