import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Highlight } from './Highlight'

describe('Highlight', () => {
  it('wraps the matched positions in <mark>', () => {
    const html = renderToStaticMarkup(<Highlight text="여름 가방끈 수선" ranges={[[4, 6]]} />)
    expect(html).toMatch(/^여름 가<mark class="[^"]*">방끈<\/mark> 수선$/)
  })

  it('draws a <script> string as text, never as an element', () => {
    const html = renderToStaticMarkup(
      <Highlight text={'a <script>alert(1)</script> b'} ranges={[[2, 10]]} />,
    )
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toMatch(/<mark class="[^"]*">&lt;script&gt;<\/mark>/)
  })

  it('does not interpret markup inside the marked part either', () => {
    const html = renderToStaticMarkup(
      <Highlight text={'<img src=x onerror=alert(1)>'} ranges={[[0, 28]]} />,
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
