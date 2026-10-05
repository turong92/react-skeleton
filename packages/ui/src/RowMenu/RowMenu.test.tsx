import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RowMenu } from './RowMenu'

const items = [
  { key: 'edit', label: 'Edit', onSelect: () => {} },
  { key: 'delete', label: 'Delete', onSelect: () => {}, danger: true },
]

describe('RowMenu', () => {
  it('renders only the menu button when closed, with menu-button ARIA and the given name', () => {
    const html = renderToStaticMarkup(<RowMenu label="More for Ada" items={items} />)
    expect(html).toMatch(/<button[^>]*aria-label="More for Ada"/)
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('role="menu"')
    expect(html).not.toContain('Edit')
  })

  it('the default trigger is a decorative ellipsis; a custom trigger replaces it', () => {
    expect(renderToStaticMarkup(<RowMenu label="m" items={items} />)).toContain(
      '<span aria-hidden="true">⋯</span>',
    )
    expect(renderToStaticMarkup(<RowMenu label="m" items={items} trigger="Share" />)).toContain(
      'Share',
    )
  })

  it('a disabled menu keeps the button focusable (aria-disabled, not disabled)', () => {
    const html = renderToStaticMarkup(<RowMenu label="m" items={items} disabled />)
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toMatch(/<button[^>]*\sdisabled/)
  })
})
