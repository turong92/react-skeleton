import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('describes the trigger: aria-describedby points at a role=tooltip element that is hidden until shown', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Copies the link">
        {(aria) => (
          <button type="button" {...aria}>
            Share
          </button>
        )}
      </Tooltip>,
    )
    const id = html.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`id="${id}"`)
    expect(html).toContain('role="tooltip"')
    expect(html).toMatch(/role="tooltip"[^>]*hidden=""|hidden=""[^>]*role="tooltip"/)
    expect(html).toContain('Copies the link')
  })

  it('placement is a data attribute', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="x" placement="bottom">
        {(aria) => <button {...aria}>b</button>}
      </Tooltip>,
    )
    expect(html).toContain('data-placement="bottom"')
  })
})
