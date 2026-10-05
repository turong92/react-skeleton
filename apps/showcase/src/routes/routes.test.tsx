import { renderToString } from 'react-dom/server'
import { MemoryRouter, matchRoutes, useRoutes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import pkg from '../../package.json'
import { packageSections } from '../demos/packageSections'
import { routes } from './routes'

afterEach(() => vi.restoreAllMocks())

function App() {
  return useRoutes(routes)
}
const page = (path: string) =>
  renderToString(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
const leaf = (path: string) => matchRoutes(routes, path)?.at(-1)?.route

describe('package sections', () => {
  it('has a demo for every @skeleton package the app declares (ui and tokens have their own pages)', () => {
    const declared = Object.keys(pkg.dependencies)
      .filter(
        (name) =>
          name.startsWith('@skeleton/') && !['@skeleton/tokens', '@skeleton/ui'].includes(name),
      )
      .sort()
    expect(packageSections.map((section) => section.pkg).sort()).toEqual(declared)
  })

  it('every section has a title, a summary and an import line naming its package', () => {
    for (const section of packageSections) {
      expect(section.title.length, section.pkg).toBeGreaterThan(0)
      expect(section.summary.length, section.pkg).toBeGreaterThan(0)
      expect(section.importLine, section.pkg).toContain(section.pkg)
    }
  })
})

describe('routes', () => {
  const paths = [
    '/',
    '/ui',
    '/tokens',
    ...packageSections.map((section) => `/packages/${section.slug}`),
  ]

  it.each(paths)('%s resolves to its own page, not the 404', (path) => {
    expect(leaf(path)?.path).toBe(path)
  })

  it('an unknown path falls through to the 404 page', () => {
    expect(leaf('/nope')?.path).toBe('*')
    expect(page('/nope')).toContain('404')
    expect(page('/packages/nope')).toContain('404')
  })

  it.each(paths)('%s renders on the server without throwing or React warnings', (path) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const html = page(path)
    expect(html).toMatch(/<h2[ >]/)
    expect(errors.mock.calls).toEqual([])
  })

  it('the secret route sits behind RequireAuth and sends an anonymous visitor to the auth demo', () => {
    expect(leaf('/packages/auth/secret')?.path).toBe('/packages/auth/secret')
    expect(page('/packages/auth/secret')).not.toContain('로그인한 사람만')
  })
})

describe('layout — keyboard and landmarks', () => {
  const html = page('/ui')

  it('starts with a skip link to the main landmark', () => {
    expect(html.indexOf('href="#main"')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('href="#main"')).toBeLessThan(html.indexOf('<nav'))
    expect(html).toMatch(/<main[^>]*id="main"/)
  })

  it('has a labelled section nav with links to every section and a theme toggle in the header', () => {
    expect(html).toMatch(/<nav[^>]*aria-label="섹션"/)
    for (const href of ['/ui', '/tokens', '/packages/auth'])
      expect(html).toContain(`href="${href}"`)
    expect(html).toMatch(/<header[\s\S]*aria-label="Theme: system"[\s\S]*<\/header>/)
  })

  it('marks the current section for assistive tech', () => {
    expect(html).toMatch(/href="\/ui"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/ui"/)
  })
})
