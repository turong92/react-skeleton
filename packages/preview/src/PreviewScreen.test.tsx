import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PreviewScreen } from './PreviewScreen'
import { createFakeFrameBridge } from './test/fakeFrameBridge'

const frame = () => ({ kind: 'frame' as const, bridge: createFakeFrameBridge() })

describe('PreviewScreen', () => {
  it('the slot is the scaled frame, the iframe stays device-sized', () => {
    const html = renderToStaticMarkup(
      <PreviewScreen
        source={frame()}
        width={390}
        height={844}
        scale={0.5}
        kind="phone"
        title="T"
      />,
    )
    expect(html).toContain('width:203px;height:430px')
    expect(html).toContain('scale(0.5)')
    expect(html).toMatch(/<iframe[^>]*width="390"[^>]*height="844"/)
  })

  it('reserveBase widens the slot to the painted desktop stand', () => {
    const html = renderToStaticMarkup(
      <PreviewScreen
        source={frame()}
        width={1280}
        height={800}
        scale={1}
        kind="desktop"
        title="T"
        reserveBase
      />,
    )
    expect(html).toContain('width:1369.52px;height:824px')
  })

  it('a frame source can bring its own sandbox', () => {
    const html = renderToStaticMarkup(
      <PreviewScreen
        source={{ ...frame(), sandbox: 'allow-scripts allow-forms' }}
        width={390}
        height={844}
        scale={1}
        kind="plain"
        title="T"
      />,
    )
    expect(html).toContain('sandbox="allow-scripts allow-forms"')
  })

  it('a modal window shrinks the iframe to the visible part and puts it at top', () => {
    const html = renderToStaticMarkup(
      <PreviewScreen
        source={frame()}
        width={390}
        height={3000}
        scale={1}
        kind="plain"
        title="T"
        view={{ top: 500, height: 600 }}
      />,
    )
    expect(html).toMatch(/<iframe[^>]*height="600"/)
    expect(html).toContain('top:500px')
  })
})
