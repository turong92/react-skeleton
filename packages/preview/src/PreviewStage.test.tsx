import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koPreviewLabels } from './labels.ko'
import { PreviewStage, type PreviewStageProps } from './PreviewStage'
import { createFakeFrameBridge } from './test/fakeFrameBridge'

type FakeOptions = Parameters<typeof createFakeFrameBridge>[0]

function render(props: Omit<PreviewStageProps, 'source'>, fakeOptions?: FakeOptions) {
  return renderToStaticMarkup(
    <PreviewStage
      source={{ kind: 'frame', bridge: createFakeFrameBridge(fakeOptions) }}
      {...props}
    />,
  )
}

function renderStage(props: PreviewStageProps) {
  return renderToStaticMarkup(<PreviewStage {...props} />)
}

describe('PreviewStage', () => {
  it('draws the iframe at the device viewport — tablet landscape is 1180×820', () => {
    const html = render({ device: 'tabletLandscape' })
    expect(html).toMatch(/<iframe[^>]*width="1180"[^>]*height="820"/)
    expect(html).toContain('title="Preview"')
    expect(html).toContain('sandbox="allow-scripts"')
    expect(html).toMatch(/referrerpolicy="no-referrer"/i)
  })

  it('pc at actual size is a named, focusable scroll region', () => {
    const html = render({ device: 'pc', pcZoom: 'actual' })
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="PC screen — scroll sideways"')
    expect(html).toContain('tabindex="0"')
  })

  it('pc follows pcWidth', () =>
    expect(render({ device: 'pc', pcWidth: 1920 })).toMatch(/<iframe[^>]*width="1920"/))

  it('a render source draws its content in a device-sized screen box, no iframe', () => {
    const html = renderStage({
      source: { kind: 'render', content: <p>hello</p> },
      device: 'phone',
    })
    expect(html).not.toContain('<iframe')
    expect(html).toContain('<p>hello</p>')
    expect(html).toContain('data-source="render"')
    expect(html).toContain('width:390px;height:844px')
  })

  it('not focusable — the frame leaves the tab order and render content is inert', () => {
    expect(render({ device: 'phone', focusable: false })).toContain('tabindex="-1"')
    expect(
      renderStage({
        source: { kind: 'render', content: 'x' },
        device: 'phone',
        focusable: false,
      }),
    ).toContain('inert=""')
  })

  it('a bridge with only attach draws and never expands', () => {
    const html = render({ device: 'phone', phone: true }, { minimal: true })
    expect(html).toContain('<iframe')
    expect(html).not.toContain('data-expanded')
  })

  it('a phone stage expands to the height the bridge already knows', () => {
    const html = render({ device: 'phone', phone: true }, { height: 2400 })
    expect(html).toContain('data-expanded')
    expect(html).toMatch(/<iframe[^>]*height="2400"/)
  })

  it('a phone stage that is not expanded takes the visible height under the head offset', () => {
    const html = render({ device: 'phone', phone: true, headOffset: 56 })
    expect(html).toContain('data-phone')
    expect(html).toContain('height:calc(100lvh - 56px)')
  })

  it('layered draws a hidden back layer', () => {
    const html = renderStage({
      source: { kind: 'frame', bridge: createFakeFrameBridge(), layered: true },
      device: 'phone',
    })
    expect(html.match(/<iframe/g)).toHaveLength(2)
    expect(html).toMatch(/<iframe[^>]*aria-hidden="true"[^>]*inert=""/)
  })

  it('labels are a prop — ko names the frame and the region', () => {
    const html = render({ device: 'pc', pcZoom: 'actual', labels: koPreviewLabels })
    expect(html).toContain('title="미리보기"')
    expect(html).toContain('aria-label="PC 화면 — 가로로 밀어 보기"')
  })
})
