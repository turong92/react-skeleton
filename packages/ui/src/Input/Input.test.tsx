import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('renders a text input and passes native props through', () => {
    const html = renderToStaticMarkup(<Input name="email" placeholder="you@example.com" />)
    expect(html).toContain('<input')
    expect(html).toContain('name="email"')
    expect(html).toContain('placeholder="you@example.com"')
    expect(html).toContain('type="text"')
  })

  it('invalid sets aria-invalid so assistive tech and the invalid style agree', () => {
    expect(renderToStaticMarkup(<Input invalid />)).toContain('aria-invalid="true"')
    expect(renderToStaticMarkup(<Input />)).not.toContain('aria-invalid')
  })

  it('keeps a caller-supplied type (password, email …)', () => {
    expect(renderToStaticMarkup(<Input type="password" />)).toContain('type="password"')
  })
})
