import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MaintenancePage, NotFoundPage, ServerErrorPage, StatusPage } from './StatusPage'

describe('StatusPage', () => {
  it('has the title as the h1, the code (decorative), the description and the actions', () => {
    const html = renderToStaticMarkup(
      <StatusPage
        code="418"
        title="Teapot"
        description="Short and stout"
        actions={<a href="/">Home</a>}
      />,
    )
    expect(html).toMatch(/<h1[^>]*>Teapot<\/h1>/)
    expect(html).toContain('Short and stout')
    expect(html).toContain('Home')
    expect(html).toMatch(/aria-hidden="true"[^>]*>418</)
  })
})

describe('NotFoundPage', () => {
  it('speaks plainly and gives a way out', () => {
    const html = renderToStaticMarkup(<NotFoundPage actions={<a href="/">Back home</a>} />)
    expect(html).toContain('404')
    expect(html).toMatch(/<h1[^>]*>Page not found<\/h1>/)
    expect(html).toContain('Back home')
  })
  it('texts are props', () => {
    expect(
      renderToStaticMarkup(
        <NotFoundPage title="없는 페이지예요" description="주소를 확인해 주세요" />,
      ),
    ).toContain('없는 페이지예요')
  })
})

describe('ServerErrorPage', () => {
  it('shows a reference number to quote when contacting support, only when it has one', () => {
    expect(renderToStaticMarkup(<ServerErrorPage reference="trace-123" />)).toContain('trace-123')
    expect(renderToStaticMarkup(<ServerErrorPage />)).not.toContain('Reference')
  })
})

describe('MaintenancePage', () => {
  it('is a polite status, and names the time it is expected back in the reader time zone', () => {
    const html = renderToStaticMarkup(
      <MaintenancePage
        until="2026-10-06T15:00:00Z"
        zone="Asia/Seoul"
        locale="en-US"
        untilLabel={(time) => `Back around ${time}`}
      />,
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('Back around')
    expect(html).toMatch(/Oct 7, 2026/)
  })
  it('without an end time it does not promise one', () => {
    expect(renderToStaticMarkup(<MaintenancePage />)).not.toContain('Back')
  })
})
