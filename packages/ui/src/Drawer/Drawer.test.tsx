import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Drawer } from './Drawer'

const render = (side?: 'left' | 'right' | 'bottom') =>
  renderToStaticMarkup(
    <Drawer open onClose={() => {}} title="Filters" side={side}>
      body
    </Drawer>,
  )

describe('Drawer', () => {
  it('is the Dialog (native <dialog> named by its title) placed at an edge, right by default', () => {
    const html = render()
    expect(html).toContain('<dialog')
    expect(html).toContain('data-placement="right"')
    expect(html).toMatch(/<h2[^>]*>Filters<\/h2>/)
    expect(html).toContain('aria-label="Close"')
  })

  it.each(['left', 'right', 'bottom'] as const)('side=%s sets the placement', (side) => {
    expect(render(side)).toContain(`data-placement="${side}"`)
  })
})
