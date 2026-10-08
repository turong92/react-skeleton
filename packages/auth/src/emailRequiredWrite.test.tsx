import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { apiError } from './test/apiFixtures'
import { createEmailRequiredController, emailWhenOf, stillNeedsAddress } from './emailRequired'
import { useEmailBeforeWrite } from './useEmailBeforeWrite'

const forbidden = (method = 'POST', path = '/posts') => ({
  path,
  method,
  error: apiError('ACCOUNT.EMAIL_REQUIRED', 403),
})

describe('emailWhenOf (what the server asks for, read from me)', () => {
  it('emailRequired true is the sign-in mode', () => {
    expect(emailWhenOf({ email: null, emailRequired: true })).toBe('login')
  })
  it('emailRequired false with emailRequiredToWrite true is the write mode', () => {
    expect(emailWhenOf({ email: null, emailRequired: false, emailRequiredToWrite: true })).toBe(
      'write',
    )
  })
  it('neither key, or both false, asks for nothing', () => {
    expect(emailWhenOf({ email: null })).toBe('none')
    expect(emailWhenOf({ email: null, emailRequired: false })).toBe('none')
    expect(emailWhenOf({ email: null, emailRequired: false, emailRequiredToWrite: false })).toBe(
      'none',
    )
  })
  it('the sign-in key wins when a server says both', () => {
    expect(emailWhenOf({ email: null, emailRequired: true, emailRequiredToWrite: true })).toBe(
      'login',
    )
  })
})

describe('stillNeedsAddress (the "did they register in another tab" check, now by the address)', () => {
  it('write mode without an address keeps the screen open (emailRequired is false there)', () => {
    expect(
      stillNeedsAddress({ email: null, emailRequired: false, emailRequiredToWrite: true }),
    ).toBe(true)
  })
  it('an address folds it, whatever the flags still say', () => {
    expect(
      stillNeedsAddress({ email: 'a@b.co', emailRequired: false, emailRequiredToWrite: true }),
    ).toBe(false)
    expect(stillNeedsAddress({ email: 'a@b.co', emailRequired: true })).toBe(false)
  })
  it('the sign-in mode behaves as it always did: emailRequired true keeps it, anything else folds', () => {
    expect(stillNeedsAddress({ emailRequired: true } as never)).toBe(true)
    expect(stillNeedsAddress({ email: null, emailRequired: false })).toBe(false)
    expect(stillNeedsAddress({ email: null })).toBe(false)
  })
})

describe('the controller remembers what the server asks for', () => {
  it('starts unknown, tells subscribers on a change only, and registering makes it none', () => {
    const controller = createEmailRequiredController()
    expect(controller.getWhen()).toBe('unknown')
    let seen = 0
    controller.subscribe(() => (seen += 1))
    controller.setWhen('write')
    controller.setWhen('write')
    expect(controller.getWhen()).toBe('write')
    expect(seen).toBe(1)
    controller.registered()
    expect(controller.getWhen()).toBe('none')
    const fresh = createEmailRequiredController()
    fresh.registered()
    expect(fresh.getWhen()).toBe('unknown') // nothing was known, nothing changes
  })

  it('in the write mode a held write ends 403 on "not now" (decline) and is sent again on registering', async () => {
    const controller = createEmailRequiredController()
    controller.setWhen('write')
    const later = controller.recover(forbidden())
    expect(controller.getState()).toEqual({ status: 'required' })
    controller.decline()
    await expect(later).resolves.toBe(false)
    expect(controller.getState()).toEqual({ status: 'idle' })
    const registered = controller.recover(forbidden())
    controller.registered()
    await expect(registered).resolves.toBe(true)
  })
})

describe('useEmailBeforeWrite', () => {
  const probe = (controller: ReturnType<typeof createEmailRequiredController>) => {
    let out: ReturnType<typeof useEmailBeforeWrite> | undefined
    function Probe() {
      out = useEmailBeforeWrite(controller)
      return null
    }
    renderToStaticMarkup(<Probe />)
    return out!
  }

  it('write mode: needed is true, ensure() opens the screen and says false', () => {
    const controller = createEmailRequiredController()
    controller.setWhen('write')
    const gate = probe(controller)
    expect(gate.needed).toBe(true)
    expect(gate.ensure()).toBe(false)
    expect(controller.getState()).toEqual({ status: 'required' })
  })

  it.each(['unknown', 'none', 'login'] as const)(
    '%s: nothing to ask before writing - needed false, ensure() says true and opens nothing',
    (when) => {
      const controller = createEmailRequiredController()
      controller.setWhen(when)
      const gate = probe(controller)
      expect(gate.needed).toBe(false)
      expect(gate.ensure()).toBe(true)
      expect(controller.getState()).toEqual({ status: 'idle' })
    },
  )

  it('ensure() reads the mode when it is called, not when the hook rendered', () => {
    const controller = createEmailRequiredController()
    const gate = probe(controller)
    controller.setWhen('write')
    expect(gate.ensure()).toBe(false)
    controller.registered()
    expect(gate.ensure()).toBe(true)
  })
})
