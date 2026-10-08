import { createEmailRequiredController } from '@skeleton/auth'
import { describe, expect, it, vi } from 'vitest'
import { subscribeGateRelease } from './gateRelease'

describe('subscribeGateRelease', () => {
  it('calls back when a gate that was open lets go (registered / agreed), not when it opens or stays idle', () => {
    const gate = createEmailRequiredController()
    const onRelease = vi.fn()
    subscribeGateRelease([gate], onRelease)
    gate.setReady(true) // 다른 알림
    gate.require()
    expect(onRelease).not.toHaveBeenCalled()
    gate.registered()
    expect(onRelease).toHaveBeenCalledTimes(1)
    gate.registered()
    expect(onRelease).toHaveBeenCalledTimes(1)
  })

  it('watches every gate and stops after unsubscribe', () => {
    const a = createEmailRequiredController()
    const b = createEmailRequiredController()
    const onRelease = vi.fn()
    const off = subscribeGateRelease([a, b], onRelease)
    b.require()
    b.registered()
    expect(onRelease).toHaveBeenCalledTimes(1)
    off()
    a.require()
    a.registered()
    expect(onRelease).toHaveBeenCalledTimes(1)
  })
})
