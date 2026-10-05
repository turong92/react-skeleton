import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InfiniteList } from './InfiniteList'
import { shouldLoadMore } from './shouldLoadMore'

describe('shouldLoadMore', () => {
  const ok = { hasMore: true, loading: false, error: false, intersecting: true }
  it('loads when the end is visible, there is more, and nothing is in flight', () => {
    expect(shouldLoadMore(ok)).toBe(true)
  })
  it.each([
    ['nothing more', { ...ok, hasMore: false }],
    ['already loading', { ...ok, loading: true }],
    ['the last page failed (wait for the retry button, no loop)', { ...ok, error: true }],
    ['the end is not visible', { ...ok, intersecting: false }],
  ])('does not load when %s', (_, input) => expect(shouldLoadMore(input)).toBe(false))
})

const base = {
  items: ['a', 'b'],
  getKey: (item: string) => item,
  renderItem: (item: string) => <span>item-{item}</span>,
  onLoadMore: () => undefined,
}

describe('InfiniteList', () => {
  it('renders a labelled list of the items', () => {
    const html = renderToStaticMarkup(<InfiniteList {...base} label="Notes" hasMore={false} />)
    expect(html).toContain('<ul')
    expect(html).toContain('aria-label="Notes"')
    expect(html).toContain('item-a')
    expect(html).toContain('item-b')
  })

  it('always offers a keyboard-reachable "Load more" button while there is more (the observer is only a convenience)', () => {
    const html = renderToStaticMarkup(<InfiniteList {...base} hasMore loadMoreLabel="Show more" />)
    expect(html).toMatch(/<button[^>]*>Show more<\/button>/)
  })

  it('no button and an end message when there is nothing more', () => {
    const html = renderToStaticMarkup(
      <InfiniteList {...base} hasMore={false} endLabel="You reached the end" />,
    )
    expect(html).not.toContain('<button')
    expect(html).toContain('You reached the end')
  })

  it('while loading: a polite status with the loading text, the button is busy', () => {
    const html = renderToStaticMarkup(
      <InfiniteList {...base} hasMore loading loadingLabel="Loading more" />,
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('Loading more')
    expect(html).toContain('aria-busy="true"')
  })

  it('on error: an alert with a retry button instead of the load-more button', () => {
    const html = renderToStaticMarkup(
      <InfiniteList {...base} hasMore error errorLabel="Could not load" retryLabel="Retry" />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Could not load')
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/)
    expect(html).not.toContain('Load more')
  })

  it('empty: shows the empty slot instead of an empty list', () => {
    const html = renderToStaticMarkup(
      <InfiniteList {...base} items={[]} hasMore={false} empty={<p>Nothing yet</p>} />,
    )
    expect(html).toContain('Nothing yet')
    expect(html).not.toContain('<ul')
  })
})
