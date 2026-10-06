import { describe, expect, it } from 'vitest'
import { scrubUrlParams, type UrlHost } from './scrubUrl'

function host(path: string): UrlHost & { replaced: string[] } {
  const url = new URL(path, 'https://app.example')
  const replaced: string[] = []
  return {
    replaced,
    location: { pathname: url.pathname, search: url.search, hash: url.hash },
    history: { state: { idx: 1 }, replaceState: (_s, _t, next) => void replaced.push(next) },
  }
}

describe('M1 — one-time tokens leave the address bar and the history entry once read', () => {
  it('removes ?token= and keeps the rest of the query', () => {
    const h = host('/reset-password?token=secret&lang=ko')
    scrubUrlParams(['token'], h)
    expect(h.replaced).toEqual(['/reset-password?lang=ko'])
  })

  it('removes #token= from the fragment', () => {
    const h = host('/verify-email#token=secret')
    scrubUrlParams(['token'], h)
    expect(h.replaced).toEqual(['/verify-email'])
  })

  it('removes an OAuth callback code and state', () => {
    const h = host('/auth/callback?code=abc&state=xyz&error_description=nope')
    scrubUrlParams(['code', 'state', 'error', 'error_description'], h)
    expect(h.replaced).toEqual(['/auth/callback'])
  })

  it('does nothing when there is nothing to remove', () => {
    const h = host('/login?lang=ko')
    scrubUrlParams(['token'], h)
    expect(h.replaced).toEqual([])
  })

  it('is safe without a window (server render)', () => {
    expect(() => scrubUrlParams(['token'], undefined)).not.toThrow()
  })
})
