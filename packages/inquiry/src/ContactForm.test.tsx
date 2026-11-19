import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ContactForm, type ContactFormProps } from './ContactForm'
import { defaultInquiryLabels as L } from './labels'

const api = { send: async () => ({ status: 'RECEIVED' }) }

const render = (props: Partial<ContactFormProps> = {}) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ContactForm api={api} onSent={() => {}} {...props} />
    </QueryClientProvider>,
  )

describe('ContactForm', () => {
  it('has the four kinds as one radio group, a required message, an optional email and a send button', () => {
    const html = render()
    expect(html).toContain('role="radiogroup"')
    for (const label of Object.values(L.form.kinds)) expect(html).toContain(`>${label}`)
    expect(html).toMatch(new RegExp(`<label[^>]*>${L.form.body}<span`))
    expect(html).toContain(`${L.form.email}</label>`)
    expect(html).toContain('<textarea')
    expect(html).toContain('type="submit"')
    expect(html).toContain(`>${L.form.submit}<`)
  })

  it('tells a signed-out sender that an empty email means no reply, a signed-in one that it is only used for the reply', () => {
    expect(render()).toContain(L.form.emailHintSignedOut)
    const signedIn = render({ signedIn: true })
    expect(signedIn).toContain(L.form.emailHintSignedIn)
    expect(signedIn).not.toContain(L.form.emailHintSignedOut)
  })

  it('prefills the email of a signed-in sender and shows the body counter from zero', () => {
    const html = render({ defaultEmail: 'me@example.com' })
    expect(html).toContain('value="me@example.com"')
    expect(html).toContain(L.form.bodyCount(0, 2000))
  })

  it('puts the app’s captcha widget and notice above the send button', () => {
    const html = render({
      captcha: { token: null, reset: () => {}, widget: <div data-testid="captcha" /> },
      beforeSubmit: <p>privacy notice</p>,
    })
    expect(html.indexOf('data-testid="captcha"')).toBeGreaterThan(-1)
    expect(html.indexOf('privacy notice')).toBeLessThan(html.indexOf('type="submit"'))
    expect(html.indexOf('data-testid="captcha"')).toBeLessThan(html.indexOf('privacy notice'))
  })

  it('shows no error before the first attempt', () => {
    const html = render({ captcha: { token: null, reset: () => {}, widget: null } })
    expect(html).not.toContain('role="alert"')
  })
})
