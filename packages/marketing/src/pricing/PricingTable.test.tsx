import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PricingPlan } from './pricing'
import { PricingTable } from './PricingTable'

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For trying out',
    price: { monthly: 0, yearly: 0 },
    features: ['1 project'],
    ctaLabel: 'Start free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: 10, yearly: 96 },
    features: ['Unlimited projects', 'Priority support'],
    ctaLabel: 'Buy Pro',
    highlighted: true,
  },
  { id: 'ent', name: 'Enterprise', price: null, features: ['SSO'], ctaLabel: 'Contact sales' },
]
const base = {
  plans,
  interval: 'monthly' as const,
  onIntervalChange: () => undefined,
  onSelect: () => undefined,
  locale: 'en-US',
  currency: 'USD',
}

describe('PricingTable', () => {
  it('lists every plan as an article with its name, features and call to action', () => {
    const html = renderToStaticMarkup(<PricingTable {...base} />)
    expect(html.match(/<article/g)).toHaveLength(3)
    expect(html).toContain('Unlimited projects')
    expect(html).toContain('Buy Pro')
    expect(html).toContain('Contact sales')
  })

  it('monthly: shows the monthly price, free as a word, custom as contact text', () => {
    const html = renderToStaticMarkup(
      <PricingTable {...base} labels={{ free: 'Free forever', custom: 'Let us talk' }} />,
    )
    expect(html).toContain('$10')
    expect(html).toContain('Free forever')
    expect(html).toContain('Let us talk')
  })

  it('yearly: shows the monthly equivalent and the yearly total, and the saving on the toggle', () => {
    const html = renderToStaticMarkup(
      <PricingTable
        {...base}
        interval="yearly"
        labels={{
          billedYearly: (total) => `Billed ${total} a year`,
          yearlySavings: (percent) => `Save ${percent}%`,
        }}
      />,
    )
    expect(html).toContain('$8')
    expect(html).toContain('Billed $96 a year')
    expect(html).toContain('Save 20%')
  })

  it('the interval toggle is a labelled group of two pressed-state buttons', () => {
    const html = renderToStaticMarkup(
      <PricingTable
        {...base}
        interval="yearly"
        labels={{ interval: 'Billing period', monthly: 'Monthly', yearly: 'Yearly' }}
      />,
    )
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Billing period"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>[^<]*Yearly|Yearly[^<]*<\/button>/)
    expect(html.match(/aria-pressed/g)).toHaveLength(2)
  })

  it('the highlighted plan is marked in words and as data, and its call to action is the primary button', () => {
    const html = renderToStaticMarkup(
      <PricingTable {...base} labels={{ highlight: 'Most popular' }} />,
    )
    expect(html).toContain('Most popular')
    expect(html.match(/data-highlighted="true"/g)).toHaveLength(1)
    expect(html).toMatch(/data-variant="primary"[^>]*>Buy Pro/)
    expect(html).toMatch(/data-variant="secondary"[^>]*>Start free/)
  })

  it('without any yearly price there is no toggle and the prices stay monthly', () => {
    const monthlyOnly: PricingPlan[] = [
      { id: 'a', name: 'A', price: { monthly: 10, yearly: null }, features: [], ctaLabel: 'Buy A' },
    ]
    const html = renderToStaticMarkup(
      <PricingTable {...base} plans={monthlyOnly} interval="yearly" />,
    )
    expect(html).not.toContain('role="group"')
    expect(html).not.toContain('aria-pressed')
    expect(html).toContain('$10')
    expect(html).not.toContain('Billed')
  })

  it('a plan with no price for the shown interval is left out of that view only', () => {
    const mixed: PricingPlan[] = [
      {
        id: 'm',
        name: 'MonthOnly',
        price: { monthly: 5, yearly: null },
        features: [],
        ctaLabel: 'a',
      },
      { id: 'b', name: 'Both', price: { monthly: 10, yearly: 96 }, features: [], ctaLabel: 'b' },
    ]
    const monthly = renderToStaticMarkup(<PricingTable {...base} plans={mixed} />)
    expect(monthly.match(/<article/g)).toHaveLength(2)
    const yearly = renderToStaticMarkup(<PricingTable {...base} plans={mixed} interval="yearly" />)
    expect(yearly.match(/<article/g)).toHaveLength(1)
    expect(yearly).not.toContain('MonthOnly')
  })

  it('a sale price strikes the regular price through and says until when', () => {
    const sale: PricingPlan[] = [
      {
        id: 'p',
        name: 'Sale',
        price: { monthly: 8, yearly: 60 },
        compareAt: { monthly: 10, yearly: 96 },
        saleEndsAt: { monthly: '2026-11-30T12:00:00Z' },
        features: [],
        ctaLabel: 'Buy',
      },
    ]
    const monthly = renderToStaticMarkup(
      <PricingTable {...base} plans={sale} labels={{ saleUntil: (d) => `Until ${d}` }} />,
    )
    expect(monthly).toMatch(/<del[^>]*><span[^>]*>Regular price <\/span>\$10<\/del>/)
    expect(monthly).toContain('$8')
    expect(monthly).toContain('Until Nov 30, 2026')
    // 연 가격에는 끝 시각이 없다 - 정가(한 달 몫 $8)만 지금 가격($5)과 함께, 기간 라벨은 없다
    const yearly = renderToStaticMarkup(<PricingTable {...base} plans={sale} interval="yearly" />)
    expect(yearly).toMatch(/<del[^>]*><span[^>]*>Regular price <\/span>\$8<\/del>/)
    expect(yearly).toContain('$5')
    expect(yearly).not.toContain('Until')
  })

  it('no strike-through when the regular price is not above the price', () => {
    const flat: PricingPlan[] = [
      {
        id: 'p',
        name: 'P',
        price: { monthly: 10, yearly: null },
        compareAt: { monthly: 10 },
        features: [],
        ctaLabel: 'Buy',
      },
    ]
    expect(renderToStaticMarkup(<PricingTable {...base} plans={flat} />)).not.toContain('<del')
  })
})
