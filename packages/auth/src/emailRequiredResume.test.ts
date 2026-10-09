import { describe, expect, it } from 'vitest'
import { createEmailRequiredController } from './emailRequired'

const resume = {
  newEmail: 'me@example.com',
  socialReauth: { provider: 'line', authorizationCode: 'code-1' },
}

describe('coming back from the provider re-confirmation', () => {
  it('opens the gate and holds the address and proof until the screen takes them', () => {
    const controller = createEmailRequiredController()
    let seen = 0
    controller.subscribe(() => (seen += 1))
    controller.offerResume(resume)
    expect(controller.getState()).toEqual({ status: 'required' })
    expect(controller.getResume()).toEqual(resume)
    expect(seen).toBeGreaterThan(0)
    controller.clearResume()
    expect(controller.getResume()).toBeNull()
    expect(controller.getState()).toEqual({ status: 'required' }) // the screen stays open
  })

  it('does not outlive the gate: leaving or registering drops a proof nobody took', () => {
    const left = createEmailRequiredController()
    left.offerResume(resume)
    left.decline()
    expect(left.getResume()).toBeNull()
    const done = createEmailRequiredController()
    done.offerResume(resume)
    done.registered()
    expect(done.getResume()).toBeNull()
  })
})
