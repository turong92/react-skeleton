import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

  it('describedBy ties an outside description (e.g. a field error) to the menu button', () => {
    const html = renderToStaticMarkup(<RowMenu label="m" items={items} describedBy="why" />)
    expect(html).toMatch(/<button[^>]*aria-describedby="why"/)
    expect(renderToStaticMarkup(<RowMenu label="m" items={items} />)).not.toContain(
      'aria-describedby',
    )
  })

  it('menu tracks may shrink (minmax(0, 1fr)) — the root cause of long labels pushing out of the box', () => {
    const css = readFileSync(join(__dirname, 'RowMenu.module.css'), 'utf8')
    expect(css).toMatch(/\.menu\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
    expect(css).toMatch(/\.entry\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
    expect(css).toMatch(/\.menu\s*\{[^}]*max-width:[^;]*100vw/)
  })
})
