import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Alert } from './Alert'

describe('Alert', () => {
  it('danger and warning interrupt (role=alert); info and success are polite (role=status)', () => {
    expect(renderToStaticMarkup(<Alert tone="danger">x</Alert>)).toContain('role="alert"')
    expect(renderToStaticMarkup(<Alert tone="warning">x</Alert>)).toContain('role="alert"')
    expect(renderToStaticMarkup(<Alert tone="info">x</Alert>)).toContain('role="status"')
    expect(renderToStaticMarkup(<Alert tone="success">x</Alert>)).toContain('role="status"')
  })

  it('default tone is info; title and body render; tone is a data attribute', () => {
    const html = renderToStaticMarkup(<Alert title="Heads up">Details</Alert>)
    expect(html).toContain('data-tone="info"')
    expect(html).toContain('Heads up')
    expect(html).toContain('Details')
  })

  it('the tone is also carried by a spoken prefix, not by colour alone', () => {
    const html = renderToStaticMarkup(<Alert tone="danger">x</Alert>)
    expect(html).toMatch(/class="[^"]*srOnly[^"]*"[^>]*>Error</)
  })

  it('shows a dismiss button only when onDismiss is given, named by dismissLabel', () => {
    expect(renderToStaticMarkup(<Alert>x</Alert>)).not.toContain('<button')
    const html = renderToStaticMarkup(
      <Alert onDismiss={() => undefined} dismissLabel="Dismiss message">
        x
      </Alert>,
    )
    expect(html).toContain('aria-label="Dismiss message"')
  })

  it('renders an action slot', () => {
    expect(renderToStaticMarkup(<Alert action={<a href="/x">Fix it</a>}>x</Alert>)).toContain(
      'Fix it',
    )
  })
})
