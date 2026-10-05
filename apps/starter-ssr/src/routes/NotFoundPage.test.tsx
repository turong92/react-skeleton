import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('is an EmptyState (h2 in the page outline) with a way back home', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(html).toMatch(/<h2[^>]*>404/)
    expect(html).toContain('요청하신 페이지를 찾을 수 없습니다.')
    expect(html).toMatch(/<a[^>]*href="\/"/)
  })
})
