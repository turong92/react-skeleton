import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('lays out a header (brand, nav, actions), the main content and an optional footer', () => {
    const html = renderToStaticMarkup(
      <AppShell
        brand={<a href="/">brand</a>}
        nav={<span>nav</span>}
        actions={<button>theme</button>}
        footer={<small>foot</small>}
      >
        <p>content</p>
      </AppShell>,
    )
    expect(html).toMatch(/<header[\s\S]*brand[\s\S]*nav[\s\S]*theme[\s\S]*<\/header>/)
    expect(html).toMatch(/<main[^>]*>[\s\S]*<p>content<\/p>[\s\S]*<\/main>/)
    expect(html).toMatch(/<footer[\s\S]*foot[\s\S]*<\/footer>/)
  })

  it('has no footer element when none is given', () => {
    expect(renderToStaticMarkup(<AppShell>x</AppShell>)).not.toContain('<footer')
  })
})
