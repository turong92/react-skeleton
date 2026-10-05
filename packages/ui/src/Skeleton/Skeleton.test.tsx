import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('is one polite status with a spoken label; the shapes themselves are hidden from assistive tech', () => {
    const html = renderToStaticMarkup(<Skeleton />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Loading')
    expect(html).toMatch(/aria-hidden="true"/)
  })

  it('draws `lines` text bars (the last one shorter) and takes a custom label', () => {
    const html = renderToStaticMarkup(<Skeleton lines={3} label="Loading notes" />)
    expect(html.match(/data-shape="text"/g)).toHaveLength(3)
    expect(html).toContain('Loading notes')
    expect(html.match(/data-last="true"/g)).toHaveLength(1)
  })

  it('shape circle / rect take a size', () => {
    const html = renderToStaticMarkup(<Skeleton shape="circle" width="3rem" height="3rem" />)
    expect(html).toContain('data-shape="circle"')
    expect(html).toContain('width:3rem')
  })
})
