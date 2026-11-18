import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultPreviewLabels } from './labels.en'
import { PreviewViewer, type PreviewViewerProps } from './PreviewViewer'

// SSR 에서는 `matchMedia` 가 없어 좁은 결이 그려진다(넓은 결 막대는 스토리가 본다)
const render = (p: Partial<PreviewViewerProps> = {}) =>
  renderToStaticMarkup(
    <PreviewViewer
      source={{ kind: 'render', content: <p>screen-marker</p> }}
      as="page"
      title="Large preview"
      onClose={() => {}}
      {...p}
    />,
  )

describe('PreviewViewer', () => {
  it('as page is a main landmark named by the title, no dialog', () => {
    const html = render()
    expect(html).toMatch(/<main[^>]*aria-label="Large preview"/)
    expect(html).not.toContain('<dialog')
  })

  it('as dialog is a full-screen dialog named by the title', () => {
    const html = render({ as: 'dialog' })
    expect(html).toContain('data-fullscreen')
    expect(html).toMatch(/<h2[^>]*>Large preview<\/h2>/)
  })

  it('draws the source content exactly once', () =>
    expect(render().match(/screen-marker/g)).toHaveLength(1))

  it('a framed device starts behind the drag shield', () =>
    expect(render({ initialDevice: 'pc' })).toContain('data-zoom-shield'))

  it('the pill names the device and the extra summary while fit', () =>
    expect(
      render({ initialDevice: 'pc', extra: { summary: ['Daytime', 'Large text'] } }),
    ).toContain('PC · Daytime · Large text'))

  it('stacks the hint, then the error, then the warning', () => {
    const html = render({ initialDevice: 'pc', error: 'err-marker', warning: 'warn-marker' })
    const at = (s: string) => html.indexOf(s)
    expect(at(defaultPreviewLabels.hintPan)).toBeLessThan(at('err-marker'))
    expect(at('err-marker')).toBeLessThan(at('warn-marker'))
    expect(html).toMatch(/role="alert"[^>]*>[\s\S]*err-marker/)
    expect(html).toMatch(/role="status"[^>]*>[\s\S]*warn-marker/)
  })
})
