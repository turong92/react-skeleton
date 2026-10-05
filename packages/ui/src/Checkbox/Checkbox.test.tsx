import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('is a real checkbox inside its label, so clicking the text toggles it', () => {
    const html = renderToStaticMarkup(<Checkbox label="Remember me" />)
    expect(html).toMatch(
      /<label[^>]*>\s*<input[^>]*type="checkbox"[\s\S]*Remember me[\s\S]*<\/label>/,
    )
  })

  it('passes checked / disabled / name / value through to the input', () => {
    const html = renderToStaticMarkup(
      <Checkbox label="x" name="terms" value="yes" checked readOnly disabled />,
    )
    expect(html).toContain('checked=""')
    expect(html).toContain('disabled=""')
    expect(html).toContain('name="terms"')
    expect(html).toContain('value="yes"')
  })

  it('shows a description linked by aria-describedby and an error as an alert with aria-invalid', () => {
    const html = renderToStaticMarkup(
      <Checkbox label="Terms" description="You must agree" error="Required" />,
    )
    const described = /<input[^>]*aria-describedby="([^"]+)"/.exec(html)?.[1].split(' ')
    expect(described).toHaveLength(2)
    for (const id of described!) expect(html).toContain(`id="${id}"`)
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('You must agree')
  })

  it('indeterminate is announced as aria-checked="mixed"', () => {
    expect(renderToStaticMarkup(<Checkbox label="All" indeterminate />)).toContain(
      'aria-checked="mixed"',
    )
    expect(renderToStaticMarkup(<Checkbox label="All" />)).not.toContain('aria-checked')
  })
})
