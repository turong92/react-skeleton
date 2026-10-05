import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { strings } from '../strings'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('is an EmptyState (h2 in the page outline) with a way back to the dashboard', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(html).toMatch(/<h2[^>]*>/)
    expect(html).toContain(strings.notFound.title)
    expect(html).toMatch(/<a[^>]*href="\/"/)
  })
})
