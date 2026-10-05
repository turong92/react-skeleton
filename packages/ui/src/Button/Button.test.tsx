import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('is a type="button" by default so it never submits a form by accident', () => {
    const html = renderToStaticMarkup(<Button>Save</Button>)
    expect(html).toContain('type="button"')
    expect(html).toContain('>Save</')
  })

  it('exposes variant and size as data attributes (primary, md by default)', () => {
    expect(renderToStaticMarkup(<Button>x</Button>)).toContain('data-variant="primary"')
    const html = renderToStaticMarkup(
      <Button variant="ghost" size="sm">
        x
      </Button>,
    )
    expect(html).toContain('data-variant="ghost"')
    expect(html).toContain('data-size="sm"')
  })

  it('loading disables the button, marks it busy and shows a spinner with the given label', () => {
    const html = renderToStaticMarkup(
      <Button loading loadingLabel="Working…">
        Save
      </Button>,
    )
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('role="status"')
    expect(html).toContain('Working…')
  })

  it('loading label has an English default and no hard-coded Korean', () => {
    expect(renderToStaticMarkup(<Button loading>Save</Button>)).toContain('Loading')
  })

  it('passes native props through (disabled, onClick, aria-*, type="submit")', () => {
    const html = renderToStaticMarkup(
      <Button type="submit" disabled aria-label="send form">
        Go
      </Button>,
    )
    expect(html).toContain('type="submit"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-label="send form"')
  })
})
