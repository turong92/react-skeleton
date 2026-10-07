import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FormProblems } from './FormProblems'

describe('FormProblems', () => {
  it('draws nothing while there is nothing to fix (no empty alert is announced)', () => {
    expect(renderToStaticMarkup(<FormProblems title="Check these" problems={[]} />)).toBe('')
  })

  it('is one alert that lists every problem as a button, so a missed field is one press away', () => {
    const html = renderToStaticMarkup(
      <FormProblems
        title="Check these"
        problems={[
          { key: 'email', message: 'Enter your email', target: 'f-email' },
          { key: 'consent', message: 'Agree to the required terms', target: 'f-consents' },
        ]}
      />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Check these')
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Enter your email<\/button>/)
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Agree to the required terms<\/button>/)
  })
})
