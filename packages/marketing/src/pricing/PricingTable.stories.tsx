import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn } from 'storybook/test'
import { PricingTable, type PricingTableProps } from './PricingTable'
import type { BillingInterval, PricingPlan } from './pricing'

/**
 * 요금제 표 — 데이터(`plans`)로 그린다. 월 · 연 토글(연 결제는 한 달 값 + 연 총액 + 절약 %), 강조 요금제, 0원 · 맞춤 가격(`price: null`).
 * 금액은 `Intl`(통화 · 로케일을 **명시** — 서버 렌더와 같아야 한다), 글자는 `labels`. 값(`interval`)은 부모가 쥔다. 조립한 모습은 `Patterns/Pricing`.
 */
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
    price: null,
    features: ['SSO', 'Audit log'],
    ctaLabel: 'Contact sales',
  },
]
const onSelect = fn()
const meta = {
  title: 'Packages/PricingTable',
  component: PricingTable,
  args: {
    plans,
    interval: 'monthly',
    onIntervalChange: fn(),
    onSelect,
    currency: 'USD',
    locale: 'en-US',
    title: 'Simple pricing',
  },
  beforeEach: () => onSelect.mockClear(),
} satisfies Meta<typeof PricingTable>
export default meta
type Story = StoryObj<typeof meta>

function Demo(props: Partial<PricingTableProps>) {
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  return (
    <PricingTable
      {...(meta.args as PricingTableProps)}
      {...props}
      interval={interval}
      onIntervalChange={setInterval}
    />
  )
}

export const MonthlyThenYearly: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('heading', { level: 2, name: 'Simple pricing' })).toBeVisible()
    await expect(canvas.getAllByRole('article')).toHaveLength(4)
    // 요금제 이름 하나 · 0원 금액 자리 하나
    await expect(canvas.getAllByText('Free')).toHaveLength(2)
    await expect(canvas.getByText('$10')).toBeVisible()
    await expect(canvas.getByText('Custom')).toBeVisible()
    const monthly = canvas.getByRole('button', { name: 'Monthly' })
    await expect(monthly).toHaveAttribute('aria-pressed', 'true')
    const yearly = canvas.getByRole('button', { name: /Yearly/ })
    await expect(yearly).toHaveTextContent('Save 20%')
    await userEvent.click(yearly)
    await expect(yearly).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByText('$8')).toBeVisible()
    await expect(canvas.getByText('Billed $96 yearly')).toBeVisible()
  },
}

export const HighlightedPlanAndSelection: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const pro = canvas.getByRole('article', { name: 'Pro' })
    await expect(pro).toHaveAttribute('data-highlighted', 'true')
    await expect(pro).toHaveTextContent('Most popular')
    await userEvent.click(canvas.getByRole('button', { name: 'Choose Pro' }))
    await expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'pro' }), 'monthly')
  },
}

export const KoreanWon: Story = {
  render: () => (
    <Demo
      currency="KRW"
      locale="ko-KR"
      title="간단한 요금제"
      plans={[
        {
          id: 'pro',
          name: '프로',
          price: { monthly: 9900, yearly: 95040 },
          features: ['프로젝트 무제한'],
          ctaLabel: '프로 선택',
          highlighted: true,
        },
        {
          id: 'free',
          name: '무료',
          price: { monthly: 0, yearly: 0 },
          features: ['프로젝트 1개'],
          ctaLabel: '무료로 시작',
        },
      ]}
      labels={{
        interval: '결제 주기',
        monthly: '월간',
        yearly: '연간',
        yearlySavings: (percent) => `${percent}% 할인`,
        perMonth: '/ 월',
        billedYearly: (total) => `연 ${total} 결제`,
        free: '무료',
        custom: '문의',
        highlight: '가장 인기',
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('₩9,900')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /연간/ }))
    await expect(canvas.getByText('₩7,920')).toBeVisible()
    await expect(canvas.getByText('연 ₩95,040 결제')).toBeVisible()
  },
}

/** 행사가 — 정가는 취소선, 기간은 「Until …」. 연 가격이 없는 요금제는 연 화면에서 숨고, 연 가격이 하나도 없으면 토글이 없다 */
export const SaleAndOptionalIntervals: Story = {
  render: () => (
    <Demo
      plans={[
        {
          id: 'basic',
          name: 'Basic',
          price: { monthly: 5, yearly: null },
          features: ['Monthly only'],
          ctaLabel: 'Choose Basic',
        },
        {
          id: 'pro',
          name: 'Pro',
          price: { monthly: 8, yearly: 60 },
          compareAt: { monthly: 10, yearly: 96 },
          saleEndsAt: { monthly: '2026-11-30T12:00:00Z' },
          features: ['Sale on both'],
          ctaLabel: 'Choose Pro',
          highlighted: true,
        },
      ]}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getAllByRole('article')).toHaveLength(2)
    await expect(canvas.getByText('$10').tagName).toBe('DEL')
    await expect(canvas.getByText(/Until Nov 30, 2026/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /Yearly/ }))
    await expect(canvas.getAllByRole('article')).toHaveLength(1)
    await expect(canvas.getByText('$8').tagName).toBe('DEL')
    await expect(canvas.getByText('$5')).toBeVisible()
  },
}

export const NoYearlyPrices: Story = {
  render: () => (
    <Demo
      plans={[
        {
          id: 'a',
          name: 'A',
          price: { monthly: 7, yearly: null },
          features: [],
          ctaLabel: 'Buy A',
        },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('group')).toBeNull()
    await expect(canvas.getByText('$7')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => <Demo />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: 'Billing period' })).toBeVisible()
  },
}
