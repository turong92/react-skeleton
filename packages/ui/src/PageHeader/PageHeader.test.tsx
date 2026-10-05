import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as the one h1 inside a header, with the description under it', () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Notes" description="Everything you wrote" />,
    )
    expect(html).toMatch(
      /<header[\s\S]*<h1[^>]*>Notes<\/h1>[\s\S]*Everything you wrote[\s\S]*<\/header>/,
    )
  })

  it('puts the back slot before the title and the actions after it', () => {
    const html = renderToStaticMarkup(
      <PageHeader title="T" back={<a href="/">Back</a>} actions={<button>New</button>} />,
    )
    expect(html.indexOf('Back')).toBeLessThan(html.indexOf('<h1'))
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('New'))
  })

  it('has no description, back or actions wrapper when none is given', () => {
    const html = renderToStaticMarkup(<PageHeader title="T" />)
    expect(html).not.toContain('<p')
    expect(html).not.toContain('<button')
  })
})
