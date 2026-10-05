import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Field } from '../Field/Field'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('is a native <textarea> with 3 rows by default and passes native props through', () => {
    const html = renderToStaticMarkup(
      <Textarea name="bio" placeholder="About you" maxLength={80} />,
    )
    expect(html).toMatch(/^<textarea /)
    expect(html).toContain('rows="3"')
    expect(html).toContain('name="bio"')
    expect(html).toContain('placeholder="About you"')
    expect(html).toContain('maxLength="80"')
  })

  it('invalid sets aria-invalid, otherwise the attribute is absent', () => {
    expect(renderToStaticMarkup(<Textarea invalid />)).toContain('aria-invalid="true"')
    expect(renderToStaticMarkup(<Textarea />)).not.toContain('aria-invalid')
  })

  it('takes the label, description and error wiring from Field', () => {
    const html = renderToStaticMarkup(
      <Field label="Bio" error="Too long">
        {(control) => <Textarea {...control} />}
      </Field>,
    )
    const id = /<textarea[^>]* id="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`<label for="${id}"`)
    expect(html).toContain('aria-invalid="true"')
    expect(html).toMatch(/aria-describedby="[^"]+"/)
  })
})
