import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect } from 'storybook/test'
// 복사해 쓸 때: 아래 한 줄을 `from '@skeleton/marketing'` 으로
import {
  CtaBand,
  FaqAccordion,
  FeatureGrid,
  Hero,
  PricingTable,
  SiteFooter,
  Testimonial,
  type BillingInterval,
} from '../index'

/**
 * 공개 랜딩 페이지 한 장 — 첫 구역(약속 + 행동) → 기능 → 고객의 한마디 → 요금제 → 자주 묻는 질문 → 마지막 권유 → 푸터(법적 링크).
 * 복사해서 문구 · 링크만 바꾼다. 글자는 앱의 번역 사전(`useT()`)에서 넘긴다. 아래 구역 순서는 읽는 순서이자 헤딩 순서(`h1` 하나 → `h2` 구역들)다.
 * 로그인한 사람이 `/` 에서 대시보드를 보게 하는 분기는 앱의 라우트가 한다(`apps/sample` 의 `HomeRoute`).
 */
const meta = {
  title: 'Patterns/Landing',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function LandingPage() {
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 var(--space-lg)' }}>
      <Hero
        eyebrow="Notes for teams"
        title="Notes that stay yours"
        subtitle="Write, attach and find everything in one calm place — with a team or on your own."
        primaryAction={<Button>Get started free</Button>}
        secondaryAction={<Button variant="secondary">Sign in</Button>}
      />
      <FeatureGrid
        title="Everything you need"
        features={[
          {
            id: 'search',
            title: 'Instant search',
            description: 'Find any note in a blink, even in thousands.',
            icon: '⌕',
          },
          {
            id: 'files',
            title: 'Attachments',
            description: 'Keep files right next to the words that explain them.',
            icon: '▤',
          },
          {
            id: 'share',
            title: 'Share safely',
            description: 'Links you can switch off, with a trail of who looked.',
            icon: '↗',
          },
        ]}
      />
      <section style={{ padding: 'var(--space-2xl) 0' }}>
        <Testimonial
          quote="It replaced three tools for our team, and nobody missed them."
          author="Ada Lovelace"
          role="CTO, Analytical Engines"
        />
      </section>
      <PricingTable
        title="Simple pricing"
        subtitle="Start free. Upgrade when it earns its place."
        currency="USD"
        locale="en-US"
        interval={interval}
        onIntervalChange={setInterval}
        onSelect={() => undefined}
        plans={[
          {
            id: 'free',
            name: 'Free',
            price: { monthly: 0, yearly: 0 },
            features: ['1 project', '100 notes'],
            ctaLabel: 'Start free',
          },
          {
            id: 'pro',
            name: 'Pro',
            price: { monthly: 10, yearly: 96 },
            features: ['Unlimited projects', 'Priority support'],
            ctaLabel: 'Choose Pro',
            highlighted: true,
          },
          {
            id: 'team',
            name: 'Team',
            price: { monthly: 25, yearly: 240 },
            features: ['Everything in Pro', 'Shared workspaces'],
            ctaLabel: 'Choose Team',
          },
        ]}
      />
      <FaqAccordion
        title="Questions"
        exclusive
        items={[
          {
            id: 'free',
            question: 'Is there a free plan?',
            answer: <p>Yes. It has one project and no time limit.</p>,
          },
          {
            id: 'cancel',
            question: 'Can I cancel any time?',
            answer: <p>Yes, from the settings page. You keep access until the period ends.</p>,
          },
          {
            id: 'data',
            question: 'Can I take my notes with me?',
            answer: <p>Export everything as files whenever you like.</p>,
          },
        ]}
      />
      <section style={{ padding: 'var(--space-2xl) 0' }}>
        <CtaBand
          title="Ready when you are"
          description="Create an account in under a minute."
          action={<Button variant="secondary">Create an account</Button>}
        />
      </section>
      <SiteFooter
        brand="Notes"
        tagline="Notes for everyone."
        columns={[
          {
            title: 'Product',
            links: [
              { label: 'Pricing', href: '#pricing' },
              { label: 'FAQ', href: '#faq' },
            ],
          },
          { title: 'Company', links: [{ label: 'Contact', href: 'mailto:hello@example.com' }] },
        ]}
        legalLabel="Legal"
        legalLinks={[
          { label: 'Terms of Service', href: '#terms' },
          { label: 'Privacy Policy', href: '#privacy' },
        ]}
        copyright="© 2026 Acme Inc."
      />
    </div>
  )
}

export const Default: Story = {
  render: () => <LandingPage />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const name of ['Everything you need', 'Simple pricing', 'Questions', 'Ready when you are'])
      await expect(canvas.getByRole('heading', { level: 2, name })).toBeVisible()
    // 한 화면 안에서 요금제 토글이 동작한다
    await userEvent.click(canvas.getByRole('button', { name: /Yearly/ }))
    await expect(canvas.getByText('Billed $96 yearly')).toBeVisible()
    // 푸터의 법적 링크
    await expect(canvas.getByRole('navigation', { name: 'Legal' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Terms of Service' })).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => <LandingPage />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible()
  },
}
