import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { CtaBand } from './CtaBand'
import { FaqAccordion } from './FaqAccordion'
import { FeatureGrid } from './FeatureGrid'
import { Hero } from './Hero'
import { SiteFooter } from './SiteFooter'
import { Testimonial } from './Testimonial'

/**
 * 랜딩 페이지의 구역들 — `@skeleton/ui` 부품으로만 짠 `Hero` · `FeatureGrid` · `FaqAccordion`(네이티브 `<details>`) · `Testimonial` · `CtaBand` · `SiteFooter`.
 * 글자는 모두 prop(앱이 번역해 넘긴다), 색 · 간격은 의미 토큰이라 라이트/다크 모두 된다. 조립한 모습은 `Patterns/Landing`.
 */
const meta = {
  title: 'Packages/Marketing sections',
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const HeroSection: Story = {
  render: () => (
    <Hero
      eyebrow="New"
      title="Notes that stay yours"
      subtitle="Write, attach and find everything in one calm place."
      primaryAction={<Button>Get started</Button>}
      secondaryAction={<Button variant="secondary">See how it works</Button>}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Notes that stay yours' }),
    ).toBeVisible()
    await expect(canvas.getByRole('region', { name: 'Notes that stay yours' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Get started' })).toBeVisible()
  },
}

export const Features: Story = {
  render: () => (
    <FeatureGrid
      title="Why Notes"
      subtitle="Everything you need, nothing you do not."
      features={[
        {
          id: 'search',
          title: 'Instant search',
          description: 'Find any note in a blink.',
          icon: '⌕',
        },
        {
          id: 'files',
          title: 'Attachments',
          description: 'Keep files next to the words.',
          icon: '▤',
        },
        { id: 'share', title: 'Share safely', description: 'Links you can switch off.', icon: '↗' },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2, name: 'Why Notes' })).toBeVisible()
    await expect(canvas.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3)
  },
}

export const Faq: Story = {
  render: () => (
    <FaqAccordion
      title="Questions"
      exclusive
      defaultOpenId="free"
      items={[
        { id: 'free', question: 'Is there a free plan?', answer: <p>Yes — with one project.</p> },
        {
          id: 'cancel',
          question: 'Can I cancel any time?',
          answer: <p>Yes, from the settings page.</p>,
        },
      ]}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    const first = canvas.getByText('Is there a free plan?').closest('details')!
    const second = canvas.getByText('Can I cancel any time?').closest('details')!
    await expect(first.open).toBe(true)
    await expect(second.open).toBe(false)
    // 요약은 키보드로 닿는다(Tab 순서) — Enter · Space 로 여닫는 것은 브라우저의 `<summary>` 기본 동작이라 합성 키 입력으로는 못 흉내 내고 클릭으로 같은 경로를 탄다
    await userEvent.tab()
    await expect(canvas.getByText('Is there a free plan?')).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByText('Can I cancel any time?')).toHaveFocus()
    // 같은 이름의 묶음이라 둘째를 열면 첫째가 닫힌다
    await userEvent.click(canvas.getByText('Can I cancel any time?'))
    await expect(second.open).toBe(true)
    await expect(first.open).toBe(false)
  },
}

export const CustomerQuote: Story = {
  render: () => (
    <Testimonial
      quote="It replaced three tools for our team."
      author="Ada Lovelace"
      role="CTO, Analytical"
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('It replaced three tools for our team.')).toBeVisible()
    await expect(canvas.getByText('Ada Lovelace')).toBeVisible()
  },
}

export const FinalCall: Story = {
  render: () => (
    <CtaBand
      title="Ready when you are"
      description="Start free — no card needed."
      action={<Button variant="secondary">Create an account</Button>}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: 'Ready when you are' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Create an account' })).toBeVisible()
  },
}

export const Footer: Story = {
  render: () => (
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
        { label: 'Terms', href: '#terms' },
        { label: 'Privacy', href: '#privacy' },
      ]}
      copyright="© 2026 Acme Inc."
      extra={
        <Button size="sm" variant="ghost">
          Cookie settings
        </Button>
      }
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('navigation', { name: 'Product' })).toBeVisible()
    await expect(canvas.getByRole('navigation', { name: 'Legal' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '#terms')
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'Pricing' })).toHaveFocus()
    await expect(canvas.getByText('© 2026 Acme Inc.')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <Hero
        title="Notes that stay yours"
        subtitle="Write, attach and find."
        primaryAction={<Button>Get started</Button>}
      />
      <CtaBand
        title="Ready when you are"
        action={<Button variant="secondary">Create an account</Button>}
      />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible()
  },
}
