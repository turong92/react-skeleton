import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Turnstile } from './Turnstile'
import { useTurnstileToken } from './useTurnstileToken'

describe('Turnstile', () => {
  it('server-renders only an empty container and never loads the script (the widget mounts in an effect)', () => {
    const loader = vi.fn()
    const html = renderToStaticMarkup(<Turnstile siteKey="k" onToken={() => {}} loader={loader} />)
    expect(html).toMatch(/^<div[^>]*data-turnstile[^>]*><\/div>$/)
    expect(loader).not.toHaveBeenCalled()
  })

  it('passes className through', () => {
    expect(
      renderToStaticMarkup(<Turnstile siteKey="k" onToken={() => {}} className="captcha" />),
    ).toContain('class="captcha"')
  })
})

describe('useTurnstileToken', () => {
  it('starts with no token and hands out props that feed it', () => {
    function Probe() {
      const captcha = useTurnstileToken()
      return (
        <p>
          {String(captcha.token)}:{typeof captcha.widgetProps.onToken}:
          {typeof captcha.widgetProps.onExpire}:{typeof captcha.reset}
        </p>
      )
    }
    expect(renderToStaticMarkup(<Probe />)).toBe('<p>null:function:function:function</p>')
  })
})
