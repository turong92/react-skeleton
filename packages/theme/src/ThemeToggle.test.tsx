import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => vi.unstubAllGlobals())

describe('ThemeToggle', () => {
  it('renders one button named after the current theme (system by default)', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(<ThemeToggle />)
    expect(html).toContain('title="Theme: system (click to change)"')
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Theme: system"')
    expect(html).toContain('type="button"')
  })

  it('takes its texts from a label prop so a project can translate them', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
    const html = renderToStaticMarkup(
      <ThemeToggle
        label={(theme) => `테마: ${theme}`}
        title={(theme) => `테마: ${theme} (눌러서 바꾸기)`}
      />,
    )
    expect(html).toContain('aria-label="테마: system"')
    expect(html).toContain('title="테마: system (눌러서 바꾸기)"')
  })
})
