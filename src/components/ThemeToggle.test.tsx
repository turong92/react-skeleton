import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => vi.unstubAllGlobals())

describe('ThemeToggle', () => {
  it('renders one button named after the current theme (system by default)', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(<ThemeToggle />)
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Theme: system"')
    expect(html).toContain('type="button"')
  })
})
