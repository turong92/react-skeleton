import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Seo, SeoProvider } from './Seo'

describe('Seo (server)', () => {
  it('draws nothing — the server writes the head as a string (renderHeadHtml); this component only keeps the browser in step', () => {
    expect(renderToStaticMarkup(<Seo title="Pricing" />)).toBe('')
    expect(
      renderToStaticMarkup(
        <SeoProvider defaults={{ siteName: 'Notes' }}>
          <Seo title="Pricing" />
        </SeoProvider>,
      ),
    ).toBe('')
  })
})
