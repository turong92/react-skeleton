import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DevicePicker } from './DevicePicker'

describe('DevicePicker', () => {
  it('four named buttons in order, only the value pressed', () => {
    const html = renderToStaticMarkup(<DevicePicker value="tabletLandscape" onChange={() => {}} />)
    expect([...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1])).toEqual([
      'Device',
      'Phone',
      'Tablet portrait',
      'Tablet landscape',
      'PC',
    ])
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toMatch(
      /aria-pressed="true"[^>]*aria-label="Tablet landscape"|aria-label="Tablet landscape"[^>]*aria-pressed="true"/,
    )
  })
})
