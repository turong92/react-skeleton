import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  it('is a native <dialog> named by its title, with children and footer', () => {
    const html = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="Delete item?" footer={<button>OK</button>}>
        This cannot be undone.
      </Dialog>,
    )
    expect(html).toContain('<dialog')
    const headingId = /<h2[^>]* id="([^"]+)"[^>]*>Delete item\?<\/h2>/.exec(html)?.[1]
    expect(headingId).toBeTruthy()
    expect(html).toContain(`aria-labelledby="${headingId}"`)
    expect(html).toContain('This cannot be undone.')
    expect(html).toContain('<button>OK</button>')
  })

  it('the close button label is a prop with an English default', () => {
    const base = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="t">
        x
      </Dialog>,
    )
    expect(base).toContain('aria-label="Close"')
    const custom = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="t" closeLabel="닫기">
        x
      </Dialog>,
    )
    expect(custom).toContain('aria-label="닫기"')
  })

  it('is not marked open while open is false (the element exists, closed)', () => {
    const html = renderToStaticMarkup(
      <Dialog open={false} onClose={() => {}} title="t">
        hidden body
      </Dialog>,
    )
    expect(html).not.toContain(' open=""')
  })
})
