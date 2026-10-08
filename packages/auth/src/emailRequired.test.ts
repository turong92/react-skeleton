import { describe, expect, it } from 'vitest'
import { apiError } from './test/apiFixtures'
import { createEmailRequiredController, isEmailRequiredError } from './emailRequired'

const forbidden = (code = 'ACCOUNT.EMAIL_REQUIRED', path = '/notes') => ({
  path,
  method: 'GET',
  error: apiError(code, 403),
})

describe('isEmailRequiredError', () => {
  it('is the 403 ACCOUNT.EMAIL_REQUIRED and nothing else', () => {
    expect(isEmailRequiredError(apiError('ACCOUNT.EMAIL_REQUIRED', 403))).toBe(true)
    expect(isEmailRequiredError(apiError('COMMON.FORBIDDEN', 403))).toBe(false)
    expect(isEmailRequiredError(new Error('x'))).toBe(false)
    expect(isEmailRequiredError(null)).toBe(false)
  })
})

describe('createEmailRequiredController', () => {
  it('ignores every other 403', async () => {
    const controller = createEmailRequiredController()
    expect(await controller.recover(forbidden('LEGAL.RECONSENT_REQUIRED'))).toBe(false)
    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('an EMAIL_REQUIRED 403 opens the screen and holds the call; registering releases it with true', async () => {
    const controller = createEmailRequiredController()
    let seen = 0
    controller.subscribe(() => (seen += 1))
    const waiting = controller.recover(forbidden())
    expect(controller.getState()).toEqual({ status: 'required' })
    let resolved = false
    void waiting.then(() => (resolved = true))
    await Promise.resolve()
    expect(resolved).toBe(false)
    controller.registered()
    await expect(waiting).resolves.toBe(true)
    expect(controller.getState()).toEqual({ status: 'idle' })
    expect(seen).toBeGreaterThan(0)
  })

  it('calls that fail together share one screen and are all released by one registration', async () => {
    const controller = createEmailRequiredController()
    const a = controller.recover(forbidden('ACCOUNT.EMAIL_REQUIRED', '/a'))
    const b = controller.recover(forbidden('ACCOUNT.EMAIL_REQUIRED', '/b'))
    controller.registered()
    await expect(Promise.all([a, b])).resolves.toEqual([true, true])
  })

  it('leaving (sign out, account deleted) releases the held calls with false', async () => {
    const controller = createEmailRequiredController()
    const waiting = controller.recover(forbidden())
    controller.decline()
    await expect(waiting).resolves.toBe(false)
    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('require() opens the screen without a held call (me.emailRequired after sign-in); registered() closes it', () => {
    const controller = createEmailRequiredController()
    controller.require()
    expect(controller.getState()).toEqual({ status: 'required' })
    controller.registered()
    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('does not notify when nothing changes', () => {
    const controller = createEmailRequiredController()
    let seen = 0
    controller.subscribe(() => (seen += 1))
    controller.registered()
    controller.decline()
    controller.require()
    controller.require()
    expect(seen).toBe(1)
  })

  it('is not ready until the gate has asked the server about this account; ready() / unready() notify once per change', () => {
    const controller = createEmailRequiredController()
    expect(controller.isReady()).toBe(false)
    let seen = 0
    controller.subscribe(() => (seen += 1))
    controller.setReady(true)
    controller.setReady(true)
    expect(controller.isReady()).toBe(true)
    controller.setReady(false)
    expect(controller.isReady()).toBe(false)
    expect(seen).toBe(2)
  })

  describe('the screen and the held calls belong to one account', () => {
    it("switching to another account (another tab signed in as B) releases A's held calls with false and closes the screen", async () => {
      const controller = createEmailRequiredController()
      controller.setAccount('a')
      const held = controller.recover(forbidden())
      expect(controller.getState()).toEqual({ status: 'required' })
      controller.setAccount('b')
      await expect(held).resolves.toBe(false)
      expect(controller.getState()).toEqual({ status: 'idle' })
      // B 가 나중에 등록해도 A 의 호출은 되살아나지 않는다
      controller.registered()
      await expect(held).resolves.toBe(false)
    })

    it('signing out drops the screen, and a 403 that arrives after the sign-out does not raise it again', async () => {
      const controller = createEmailRequiredController()
      controller.setAccount('a')
      controller.require()
      controller.setAccount(null)
      expect(controller.getState()).toEqual({ status: 'idle' })
      expect(await controller.recover(forbidden())).toBe(false)
      expect(controller.getState()).toEqual({ status: 'idle' })
    })

    it('telling it the same account again changes nothing', () => {
      const controller = createEmailRequiredController()
      controller.setAccount('a')
      controller.require()
      controller.setAccount('a')
      expect(controller.getState()).toEqual({ status: 'required' })
    })

    it('a controller nobody told about the account still holds calls (old behaviour)', () => {
      const controller = createEmailRequiredController()
      void controller.recover(forbidden())
      expect(controller.getState()).toEqual({ status: 'required' })
    })
  })
})
