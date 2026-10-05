import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('shows the title as a heading and the description under it', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No notifications" description="You are all caught up." />,
    )
    expect(html).toMatch(/<h3[^>]*>No notifications<\/h3>/)
    expect(html).toContain('You are all caught up.')
  })

  it('the heading level is a prop (default h3) so it fits any page outline', () => {
    expect(renderToStaticMarkup(<EmptyState title="t" headingLevel={2} />)).toMatch(
      /<h2[^>]*>t<\/h2>/,
    )
  })

  it('renders an icon (hidden from screen readers) and an action when given', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="t" icon={<svg />} action={<button>Add</button>} />,
    )
    expect(html).toMatch(/aria-hidden="true"[^>]*><svg/)
    expect(html).toContain('<button>Add</button>')
  })

  it('without description, icon or action those parts are absent', () => {
    const html = renderToStaticMarkup(<EmptyState title="t" />)
    expect(html).not.toContain('<p')
    expect(html).not.toContain('aria-hidden')
  })
})
