import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Switch } from './Switch'

describe('Switch', () => {
  it('is a checkbox with role="switch" inside its label (Space toggles it natively)', () => {
    const html = renderToStaticMarkup(<Switch label="Email alerts" />)
    expect(html).toMatch(/<label[^>]*>\s*<input[^>]*>/)
    const input = /<input[^>]*>/.exec(html)![0]
    expect(input).toContain('type="checkbox"')
    expect(input).toContain('role="switch"')
    expect(html).toContain('Email alerts')
  })

  it('the on state is the checked attribute, disabled passes through', () => {
    const html = renderToStaticMarkup(<Switch label="x" checked readOnly disabled />)
    expect(html).toContain('checked=""')
    expect(html).toContain('disabled=""')
  })

  it('a description is linked with aria-describedby', () => {
    const html = renderToStaticMarkup(<Switch label="Beta" description="Try new things" />)
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`id="${id}"`)
    expect(html).toContain('Try new things')
  })
})
