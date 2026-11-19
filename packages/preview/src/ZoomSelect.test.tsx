import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultPreviewLabels } from './labels.en'
import type { PanZoom } from './usePanZoom'
import { ZoomSelect } from './ZoomSelect'

const noop = () => undefined

function renderZoom(part: Pick<PanZoom, 'mode' | 'scale' | 'fit'>) {
  const zoom: PanZoom = {
    ...part,
    pan: { x: 0, y: 0 },
    pannable: false,
    setScale: noop,
    zoomBy: noop,
    bind: {
      ref: noop,
      onPointerDown: noop,
      onPointerMove: noop,
      onPointerUp: noop,
      onPointerCancel: noop,
      onLostPointerCapture: noop,
      onPointerLeave: noop,
      onKeyDown: noop,
    },
  }
  return renderToStaticMarkup(<ZoomSelect zoom={zoom} layout="bar" labels={defaultPreviewLabels} />)
}

const options = (html: string) =>
  [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1])

describe('ZoomSelect', () => {
  it('fit lists fit, then the six steps with 100% as actual size', () => {
    const html = renderZoom({ mode: 'fit', scale: 0.5, fit: 0.5 })
    expect(options(html)).toEqual([
      'Fit (50%)',
      '50%',
      '75%',
      '100% (actual size)',
      '125%',
      '150%',
      '200%',
    ])
  })

  it('a zoom between steps shows itself first', () =>
    expect(options(renderZoom({ mode: 0.6, scale: 0.6, fit: 0.4 }))[0]).toBe('60%'))

  it('at 200% the + button is aria-disabled, not disabled', () => {
    const html = renderZoom({ mode: 2, scale: 2, fit: 0.4 })
    expect(html).toMatch(
      /aria-disabled="true"[^>]*aria-label="Zoom in"|aria-label="Zoom in"[^>]*aria-disabled="true"/,
    )
    expect(html).not.toContain(' disabled=""')
  })

  it('an end button points at the zoom select as the reason', () => {
    const html = renderZoom({ mode: 2, scale: 2, fit: 0.4 })
    const selectId = /<select[^>]* id="([^"]+)"/.exec(html)?.[1]
    expect(selectId).toBeTruthy()
    expect(html).toContain(`aria-describedby="${selectId}"`)
  })
})
