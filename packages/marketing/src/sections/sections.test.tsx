import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CtaBand } from './CtaBand'
import { FaqAccordion } from './FaqAccordion'
import { FeatureGrid } from './FeatureGrid'
import { Hero } from './Hero'
import { SiteFooter } from './SiteFooter'
import { Testimonial } from './Testimonial'

describe('Hero', () => {
  it('is a section named by its h1, with eyebrow, subtitle and both actions', () => {
    const html = renderToStaticMarkup(
      <Hero
        eyebrow="New"
        title="Notes that stay yours"
        subtitle="Write, share, find"
        primaryAction={<a href="/signup">Start</a>}
        secondaryAction={<a href="/tour">Tour</a>}
      />,
    )
    expect(html).toContain('<section')
    expect(html).toMatch(/<h1[^>]*>Notes that stay yours<\/h1>/)
    expect(html).toContain('New')
    expect(html).toContain('Write, share, find')
    expect(html).toContain('Start')
    expect(html).toContain('Tour')
  })
  it('headingLevel lowers the heading when the page has its own h1', () => {
    expect(renderToStaticMarkup(<Hero title="T" headingLevel={2} />)).toMatch(/<h2/)
  })
})

describe('FeatureGrid', () => {
  it('is a list of features, each with its own heading below the section heading', () => {
    const html = renderToStaticMarkup(
      <FeatureGrid
        title="Why Notes"
        features={[
          { id: 'a', title: 'Fast', description: 'Instant search' },
          { id: 'b', title: 'Private', description: 'Encrypted' },
        ]}
      />,
    )
    expect(html).toMatch(/<h2[^>]*>Why Notes<\/h2>/)
    expect(html.match(/<li/g)).toHaveLength(2)
    expect(html).toMatch(/<h3[^>]*>Fast<\/h3>/)
  })
})

describe('FaqAccordion', () => {
  const items = [
    { id: 'q1', question: 'Is it free?', answer: <p>Yes, to start.</p> },
    { id: 'q2', question: 'Can I cancel?', answer: <p>Any time.</p> },
  ]
  it('uses native disclosure elements (works without JS, keyboard for free)', () => {
    const html = renderToStaticMarkup(<FaqAccordion title="Questions" items={items} />)
    expect(html.match(/<details/g)).toHaveLength(2)
    expect(html.match(/<summary/g)).toHaveLength(2)
    expect(html).toContain('Yes, to start.')
  })
  it('exclusive groups the items by name so opening one closes the others; defaultOpenId opens one', () => {
    const html = renderToStaticMarkup(
      <FaqAccordion title="Q" items={items} exclusive defaultOpenId="q2" />,
    )
    expect(html.match(/name="/g)).toHaveLength(2)
    expect(html.match(/<details[^>]*open=""/g)).toHaveLength(1)
  })
})

describe('Testimonial', () => {
  it('is a figure: quote, then who said it', () => {
    const html = renderToStaticMarkup(
      <Testimonial quote="It just works." author="Ada Lovelace" role="CTO, Analytical" />,
    )
    expect(html).toContain('<figure')
    expect(html).toContain('<blockquote')
    expect(html).toContain('It just works.')
    expect(html).toMatch(/<figcaption[\s\S]*Ada Lovelace[\s\S]*CTO, Analytical/)
  })
})

describe('CtaBand', () => {
  it('has a heading, a description and one action', () => {
    const html = renderToStaticMarkup(
      <CtaBand
        title="Ready?"
        description="Start in a minute"
        action={<a href="/signup">Sign up</a>}
      />,
    )
    expect(html).toMatch(/<h2[^>]*>Ready\?<\/h2>/)
    expect(html).toContain('Start in a minute')
    expect(html).toContain('Sign up')
  })
})

describe('SiteFooter', () => {
  const props = {
    brand: 'Notes',
    tagline: 'Notes for everyone',
    columns: [{ title: 'Product', links: [{ label: 'Pricing', href: '/pricing' }] }],
    legalLinks: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
    ],
    legalLabel: 'Legal',
    copyright: '© 2026 Acme',
  }
  it('has named navigation for each column and for the legal links, and the copyright line', () => {
    const html = renderToStaticMarkup(<SiteFooter {...props} />)
    expect(html).toContain('aria-label="Product"')
    expect(html).toContain('aria-label="Legal"')
    expect(html).toContain('href="/terms"')
    expect(html).toContain('© 2026 Acme')
    expect(html).not.toContain('<footer')
  })
  it('extra slots (a cookie-settings button, a language menu) go at the end', () => {
    expect(
      renderToStaticMarkup(
        <SiteFooter {...props} extra={<button type="button">Cookie settings</button>} />,
      ),
    ).toContain('Cookie settings')
  })
  it('renderLink lets the app use its router link', () => {
    const html = renderToStaticMarkup(
      <SiteFooter
        {...props}
        renderLink={(link, children) => (
          <a data-router="1" href={link.href}>
            {children}
          </a>
        )}
      />,
    )
    expect(html.match(/data-router="1"/g)).toHaveLength(3)
  })
})
