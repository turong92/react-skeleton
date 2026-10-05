import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Select } from './Select'

describe('Select', () => {
  it('renders a native select with its options and passes props through', () => {
    const html = renderToStaticMarkup(
      <Select name="role" defaultValue="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    )
    expect(html).toContain('<select')
    expect(html).toContain('name="role"')
    expect(html).toContain('<option value="b" selected="">B</option>')
  })

  it('invalid sets aria-invalid', () => {
    expect(renderToStaticMarkup(<Select invalid />)).toContain('aria-invalid="true"')
  })
})
