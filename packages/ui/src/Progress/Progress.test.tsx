import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Progress } from './Progress'

describe('Progress', () => {
  it('is a native progress with an accessible name and a 0..1 scale', () => {
    const html = renderToStaticMarkup(<Progress label="Uploading" value={0.42} valueText="42%" />)
    expect(html).toMatch(/<progress[^>]*aria-label="Uploading"/)
    expect(html).toContain('value="0.42"')
    expect(html).toContain('max="1"')
    expect(html).toContain('42%')
  })

  it('without a value it is indeterminate (no value attribute)', () => {
    const html = renderToStaticMarkup(<Progress label="Working" />)
    expect(html).not.toContain('value=')
  })

  it('clamps the value into 0..1', () => {
    expect(renderToStaticMarkup(<Progress label="x" value={7} />)).toContain('value="1"')
    expect(renderToStaticMarkup(<Progress label="x" value={-1} />)).toContain('value="0"')
  })
})
