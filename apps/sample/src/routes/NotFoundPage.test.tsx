import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  afterEach(() => i18n.setLocale('ko', { remember: false }))

  it('is an EmptyState (h2 in the page outline) with a way back to the dashboard', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(html).toMatch(/<h2[^>]*>/)
    expect(html).toContain(i18n.t('notFound.title'))
    expect(html).toMatch(/<a[^>]*href="\/"/)
  })

  it('draws in English when the language is English', async () => {
    await i18n.setLocale('en', { remember: false })
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(html).toContain('Page not found')
    expect(html).toContain('Go to the dashboard')
  })
})
