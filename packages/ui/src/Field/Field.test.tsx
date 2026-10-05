import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Input } from '../Input/Input'
import { Field } from './Field'

function idOf(html: string, tag: string) {
  return new RegExp(`<${tag}[^>]* id="([^"]+)"`).exec(html)?.[1]
}

describe('Field', () => {
  it('ties the label to the control through a generated id', () => {
    const html = renderToStaticMarkup(
      <Field label="Email">{(control) => <Input {...control} />}</Field>,
    )
    const inputId = idOf(html, 'input')
    expect(inputId).toBeTruthy()
    expect(html).toContain(`<label for="${inputId}"`)
    expect(html).toContain('>Email</')
  })

  it('shows a hint and points aria-describedby at it', () => {
    const html = renderToStaticMarkup(
      <Field label="Email" hint="We never share it">
        {(control) => <Input {...control} />}
      </Field>,
    )
    const hintId = idOf(html, 'p')
    expect(html).toContain('We never share it')
    expect(html).toContain(`aria-describedby="${hintId}"`)
  })

  it('shows an error as an alert, marks the control invalid and prefers it over the hint in describedby', () => {
    const html = renderToStaticMarkup(
      <Field label="Email" hint="hint text" error="Not an email">
        {(control) => <Input {...control} />}
      </Field>,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Not an email')
    expect(html).toContain('aria-invalid="true"')
    const errorId =
      /<p[^>]* id="([^"]+)"[^>]*role="alert"|<p[^>]*role="alert"[^>]* id="([^"]+)"/.exec(html)
    expect(errorId).toBeTruthy()
    const described = /aria-describedby="([^"]+)"/.exec(html)?.[1].split(' ')
    expect(described).toContain(errorId![1] ?? errorId![2])
  })

  it('the required mark text is a prop with a default', () => {
    const base = renderToStaticMarkup(
      <Field label="Name" required>
        {(control) => <Input {...control} />}
      </Field>,
    )
    expect(base).toContain('*')
    const custom = renderToStaticMarkup(
      <Field label="이름" required requiredMark="(필수)">
        {(control) => <Input {...control} />}
      </Field>,
    )
    expect(custom).toContain('(필수)')
    expect(custom).not.toContain('>*<')
  })
})
