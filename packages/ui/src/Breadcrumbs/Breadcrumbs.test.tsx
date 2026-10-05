import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Breadcrumbs } from './Breadcrumbs'

const items = [
  { label: 'Home', href: '/' },
  { label: 'Notes', href: '/notes' },
  { label: 'Weekly sync' },
]

describe('Breadcrumbs', () => {
  it('is a labelled nav with an ordered list; the last item is the current page and not a link', () => {
    const html = renderToStaticMarkup(<Breadcrumbs label="Breadcrumb" items={items} />)
    expect(html).toContain('<nav')
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toContain('<ol')
    expect(html.match(/<a /g)).toHaveLength(2)
    expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>Weekly sync<\/span>/)
  })

  it('separators are decorative (aria-hidden)', () => {
    const html = renderToStaticMarkup(<Breadcrumbs label="b" items={items} />)
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2)
  })

  it('renderLink lets the app use its router link', () => {
    const html = renderToStaticMarkup(
      <Breadcrumbs
        label="b"
        items={items}
        renderLink={(item, children) => (
          <a data-router="yes" href={item.href}>
            {children}
          </a>
        )}
      />,
    )
    expect(html.match(/data-router="yes"/g)).toHaveLength(2)
  })

  it('an item that is last but has an href is still the current page (not a link)', () => {
    const html = renderToStaticMarkup(
      <Breadcrumbs
        label="b"
        items={[
          { label: 'A', href: '/' },
          { label: 'B', href: '/b' },
        ]}
      />,
    )
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain('aria-current="page"')
  })
})
