import { describe, expect, it } from 'vitest'
import { PAYMENT_E2E_SKELETON } from './paymentE2eConfig'

const seconds = (duration: string) => {
  const match = /^(\d+)(s|m)$/.exec(duration)
  if (!match) throw new Error(`not a simple duration: ${duration}`)
  return Number(match[1]) * (match[2] === 'm' ? 60 : 1)
}
const { payment, http } = PAYMENT_E2E_SKELETON
const responseTimeout = seconds(http.clients['payment-toss']['response-timeout'])

describe('the backend settings the payment e2e asks for', () => {
  it('lifts the order-creation limits (10 per account and 30 per IP in 10 minutes by default - one run makes more orders than that from one account and one address), under the key names of docs/config/modules/payment.yml', () => {
    const limit = payment.http['order-rate-limit']
    expect(Object.keys(limit).sort()).toEqual(['account-capacity', 'ip-capacity'])
    expect(limit['account-capacity']).toBeGreaterThanOrEqual(200)
    expect(limit['ip-capacity']).toBeGreaterThanOrEqual(200)
  })

  it('has a webhook path token the backend accepts in a protected profile (24+ characters, at least 8 different ones, only characters an address can hold) - no scenario sends a webhook yet', () => {
    const token = payment.webhook['path-token']
    expect(token.length).toBeGreaterThanOrEqual(24)
    expect(new Set(token).size).toBeGreaterThanOrEqual(8)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('the first lookup after a confirm is later than the provider response limit (the backend refuses to start otherwise — spec §9.2)', () => {
    expect(seconds(payment.reconcile['first-delay'])).toBeGreaterThan(responseTimeout)
  })

  it('the provider response limit is not below the 10 seconds the backend guard warns about, and the whole wait of a scenario stays small', () => {
    expect(responseTimeout).toBeGreaterThanOrEqual(10)
    expect(seconds(payment.reconcile['first-delay'])).toBeLessThanOrEqual(15)
  })

  it('an order left at the payment window is closed by the expiry job in well under the 90 seconds scenario ② waits, and not so soon that a slow first run loses its own payment', () => {
    const ttl = seconds(payment['checkout-ttl'])
    expect(ttl).toBeGreaterThanOrEqual(40)
    expect(ttl).toBeLessThanOrEqual(60)
  })
})

describe('the client-ip mode of the payment e2e backend', () => {
  it('is cloudflare and trusts only loopback peers, so a test sets the country with CF-IPCountry and nobody else can', () => {
    const { web } = PAYMENT_E2E_SKELETON
    expect(web['client-ip'].mode).toBe('cloudflare')
    expect(web['client-ip']['trusted-proxies']).toEqual(['127.0.0.1/32', '::1/128'])
  })
})
