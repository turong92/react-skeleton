import { describe, expect, it, vi } from 'vitest'
import { normalizeMethodsInfo } from '../discovery'
import { warnDeliveryOnce, warnRedirectOnce } from './discovery'

const cookieBackend = normalizeMethodsInfo({ methods: ['password'], refreshDelivery: 'cookie' })

describe('M6 — the delivery-mismatch warning is remembered per routes instance, not in a module global', () => {
  it('warns once per instance, and an independent instance warns again', () => {
    const warn = vi.fn()
    const first = { warned: false }
    warnDeliveryOnce(cookieBackend, 'body', first, warn)
    warnDeliveryOnce(cookieBackend, 'body', first, warn)
    expect(warn).toHaveBeenCalledTimes(1)
    warnDeliveryOnce(cookieBackend, 'body', { warned: false }, warn)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('stays quiet when both sides agree', () => {
    const warn = vi.fn()
    warnDeliveryOnce(cookieBackend, 'cookie', { warned: false }, warn)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('the redirect-uri warning (exact-match pitfalls) is also once per routes instance', () => {
  const info = normalizeMethodsInfo({
    methods: ['password'],
    social: [
      { provider: 'line', clientId: 'c', redirectUri: 'https://app.example.com/auth/callback/' },
    ],
  })

  it('names the provider and the difference once, and stays quiet when the backend agrees', () => {
    const warn = vi.fn()
    const notes = { warned: false }
    warnRedirectOnce(info, 'https://app.example.com/auth/callback', notes, warn)
    warnRedirectOnce(info, 'https://app.example.com/auth/callback', notes, warn)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('line')
    expect(warn.mock.calls[0][0]).toContain('trailing slash')
    const quiet = vi.fn()
    warnRedirectOnce(info, 'https://app.example.com/auth/callback/', { warned: false }, quiet)
    expect(quiet).not.toHaveBeenCalled()
  })
})
