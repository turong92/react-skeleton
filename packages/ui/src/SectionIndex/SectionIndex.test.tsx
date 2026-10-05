import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SectionIndex } from './SectionIndex'

const items = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security', count: 2 },
]

describe('SectionIndex', () => {
  it('is a labelled nav with an ordered list of in-page anchors (works without JavaScript)', () => {
    const html = renderToStaticMarkup(<SectionIndex label="On this page" items={items} />)
    expect(html).toMatch(/<nav[^>]*aria-label="On this page"/)
    expect(html).toContain('<ol')
    expect(html).toContain('href="#profile"')
    expect(html).toContain('href="#security"')
    expect(html).toContain('Profile')
  })

  it('shows an optional count after the label', () => {
    const html = renderToStaticMarkup(<SectionIndex label="x" items={items} />)
    expect(html).toMatch(/Security<\/span><span[^>]*>2<\/span>/)
  })

  it('marks no link as current on the server (the observer runs in the browser)', () => {
    expect(renderToStaticMarkup(<SectionIndex label="x" items={items} />)).not.toContain(
      'aria-current',
    )
  })
})
