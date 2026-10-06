import { describe, expect, it, vi } from 'vitest'
import { normalizeMethodsInfo } from '../discovery'
import { warnDeliveryOnce } from './discovery'

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
