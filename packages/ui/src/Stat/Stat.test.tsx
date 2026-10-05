import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Stat } from './Stat'

describe('Stat', () => {
  it('reads as label then value then hint (term, description, description)', () => {
    const html = renderToStaticMarkup(<Stat label="Notes" value={12} hint="3 pinned" />)
    expect(html).toMatch(
      /<dt[^>]*>Notes<\/dt>[\s\S]*<dd[^>]*>12<\/dd>[\s\S]*<dd[^>]*>3 pinned<\/dd>/,
    )
  })

  it('has no hint element without a hint and carries the tone', () => {
    const html = renderToStaticMarkup(<Stat label="L" value="1" tone="warning" />)
    expect(html.match(/<dd/g)?.length).toBe(1)
    expect(html).toContain('data-tone="warning"')
  })
})
