import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders children in a section', () => {
    expect(renderToStaticMarkup(<Card>body</Card>)).toMatch(
      /^<section[^>]*>[\s\S]*body[\s\S]*<\/section>$/,
    )
  })

  it('renders an optional title (as a heading the section is labelled by) and actions', () => {
    const html = renderToStaticMarkup(
      <Card title="Profile" actions={<button>Edit</button>}>
        body
      </Card>,
    )
    expect(html).toMatch(/<h2[^>]* id="([^"]+)"[^>]*>Profile<\/h2>/)
    const headingId = /<h2[^>]* id="([^"]+)"/.exec(html)![1]
    expect(html).toContain(`aria-labelledby="${headingId}"`)
    expect(html).toContain('<button>Edit</button>')
  })

  it('has no heading and no aria-labelledby without a title', () => {
    const html = renderToStaticMarkup(<Card>body</Card>)
    expect(html).not.toContain('<h2')
    expect(html).not.toContain('aria-labelledby')
  })
})
