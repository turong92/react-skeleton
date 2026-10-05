import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Pagination } from './Pagination'

const noop = () => {}

describe('Pagination', () => {
  it('is a labelled <nav> whose pages are buttons and the current one has aria-current="page"', () => {
    const html = renderToStaticMarkup(<Pagination page={1} totalPages={4} onPageChange={noop} />)
    expect(html).toMatch(/^<nav[^>]*aria-label="Pagination"/)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toMatch(
      /<button[^>]*aria-current="page"[^>]*>2<\/button>|<button[^>]*>2<\/button>/,
    )
    expect(html).toContain('>1<')
    expect(html).toContain('>4<')
  })

  it('previous is disabled on the first page and next on the last', () => {
    const first = renderToStaticMarkup(<Pagination page={0} totalPages={3} onPageChange={noop} />)
    expect(/<button[^>]*aria-label="Previous page"[^>]*>/.exec(first)![0]).toContain('disabled=""')
    expect(/<button[^>]*aria-label="Next page"[^>]*>/.exec(first)![0]).not.toContain('disabled=""')
    const last = renderToStaticMarkup(<Pagination page={2} totalPages={3} onPageChange={noop} />)
    expect(/<button[^>]*aria-label="Next page"[^>]*>/.exec(last)![0]).toContain('disabled=""')
  })

  it('every label is a prop with an English default, and page buttons get a spoken name', () => {
    const html = renderToStaticMarkup(
      <Pagination
        page={0}
        totalPages={2}
        onPageChange={noop}
        label="페이지"
        previousLabel="이전"
        nextLabel="다음"
        pageLabel={(n) => `${n} 페이지`}
      />,
    )
    expect(html).toContain('aria-label="페이지"')
    expect(html).toContain('aria-label="이전"')
    expect(html).toContain('aria-label="다음"')
    expect(html).toContain('aria-label="2 페이지"')
    const base = renderToStaticMarkup(<Pagination page={0} totalPages={2} onPageChange={noop} />)
    expect(base).toContain('aria-label="Page 2"')
  })

  it('renders nothing when there is at most one page', () => {
    expect(renderToStaticMarkup(<Pagination page={0} totalPages={1} onPageChange={noop} />)).toBe(
      '',
    )
    expect(renderToStaticMarkup(<Pagination page={0} totalPages={0} onPageChange={noop} />)).toBe(
      '',
    )
  })

  it('collapsed runs show a non-interactive ellipsis hidden from screen readers', () => {
    const html = renderToStaticMarkup(<Pagination page={5} totalPages={20} onPageChange={noop} />)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('…')
  })
})
