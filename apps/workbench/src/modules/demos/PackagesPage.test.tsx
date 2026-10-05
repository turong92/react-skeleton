import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PackagesPage } from './PackagesPage'

describe('PackagesPage (the examples page for the new packages)', () => {
  it('server-renders without touching the network, with one tab per package and the first panel visible', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })}
      >
        <PackagesPage />
      </QueryClientProvider>,
    )
    for (const name of [
      'notifications',
      'storage',
      'payment',
      'captcha-turnstile',
      'auth · social',
      'ui',
    ])
      expect(html).toContain(name)
    const outerTabs = /aria-label="패키지"[^>]*>([\s\S]*?)<\/div>/.exec(html)![1]
    expect(outerTabs.match(/role="tab"/g)).toHaveLength(6)
    expect(html).toContain('aria-label="Notifications"')
  })
})
