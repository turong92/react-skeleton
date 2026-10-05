import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  afterEach(() => i18n.setLocale('ko', { remember: false }))

  it('is the 404 status page (the h1 of the page) with a way back home, and tells search engines not to index it', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(html).toMatch(/<h1[^>]*>/)
    expect(html).toContain('404')
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
    expect(html).toContain('Go home')
  })
})
