import { describe, expect, it } from 'vitest'
import { apiError } from './test/apiFixtures'
import { createEmailRequiredController } from './emailRequired'
import { createLoginIdRequiredController, isLoginIdRequiredError } from './loginIdRequired'

const forbidden = (code = 'ACCOUNT.LOGIN_ID_REQUIRED', path = '/notes') => ({
  path,
  method: 'POST',
  error: apiError(code, 403),
})

describe('isLoginIdRequiredError', () => {
  it('is the 403 ACCOUNT.LOGIN_ID_REQUIRED and nothing else', () => {
    expect(isLoginIdRequiredError(apiError('ACCOUNT.LOGIN_ID_REQUIRED', 403))).toBe(true)
    expect(isLoginIdRequiredError(apiError('ACCOUNT.EMAIL_REQUIRED', 403))).toBe(false)
    expect(isLoginIdRequiredError(apiError('ACCOUNT.LOGIN_ID_REQUIRED', 409))).toBe(false)
    expect(isLoginIdRequiredError(new Error('x'))).toBe(false)
    expect(isLoginIdRequiredError(null)).toBe(false)
  })
})

describe('createLoginIdRequiredController', () => {
  it('ignores every other 403, including the email one (the two gates do not steal each other’s calls)', async () => {
    const controller = createLoginIdRequiredController()
    expect(await controller.recover(forbidden('ACCOUNT.EMAIL_REQUIRED'))).toBe(false)
    expect(await controller.recover(forbidden('LEGAL.RECONSENT_REQUIRED'))).toBe(false)
    expect(controller.getState()).toEqual({ status: 'idle' })
    const email = createEmailRequiredController()
    expect(await email.recover(forbidden())).toBe(false)
    expect(email.getState()).toEqual({ status: 'idle' })
  })

  it('a LOGIN_ID_REQUIRED 403 opens the screen and holds the call; choosing releases it with true', async () => {
    const controller = createLoginIdRequiredController()
    let seen = 0
    controller.subscribe(() => (seen += 1))
    const waiting = controller.recover(forbidden())
    expect(controller.getState()).toEqual({ status: 'required' })
    let resolved = false
    void waiting.then(() => (resolved = true))
    await Promise.resolve()
    expect(resolved).toBe(false)
    controller.chosen()
    await expect(waiting).resolves.toBe(true)
    expect(controller.getState()).toEqual({ status: 'idle' })
    expect(seen).toBeGreaterThan(0)
  })

  it('calls that fail together share one screen and are all released by one choice', async () => {
    const controller = createLoginIdRequiredController()
    const a = controller.recover(forbidden('ACCOUNT.LOGIN_ID_REQUIRED', '/a'))
    const b = controller.recover(forbidden('ACCOUNT.LOGIN_ID_REQUIRED', '/b'))
    controller.chosen()
    await expect(Promise.all([a, b])).resolves.toEqual([true, true])
  })

  it('leaving (sign out, account deleted) releases the held calls with false', async () => {
    const controller = createLoginIdRequiredController()
    const waiting = controller.recover(forbidden())
    controller.decline()
    await expect(waiting).resolves.toBe(false)
    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('require() opens the screen without a held call (me.loginId === null after sign-in); chosen() closes it', () => {
    const controller = createLoginIdRequiredController()
    controller.require()
    expect(controller.getState()).toEqual({ status: 'required' })
    controller.chosen()
    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('does not notify when nothing changes', () => {
    const controller = createLoginIdRequiredController()
    let seen = 0
    controller.subscribe(() => (seen += 1))
    controller.chosen()
    controller.decline()
    controller.require()
    controller.require()
    expect(seen).toBe(1)
  })

  it('is not ready until the gate has asked the server about this account', () => {
    const controller = createLoginIdRequiredController()
    expect(controller.isReady()).toBe(false)
    let seen = 0
    controller.subscribe(() => (seen += 1))
    controller.setReady(true)
    controller.setReady(true)
    expect(controller.isReady()).toBe(true)
    controller.setReady(false)
    expect(seen).toBe(2)
  })

  describe('the screen and the held calls belong to one account', () => {
    it("switching to another account releases A's held calls with false and closes the screen", async () => {
      const controller = createLoginIdRequiredController()
      controller.setAccount('a')
      const held = controller.recover(forbidden())
      expect(controller.getState()).toEqual({ status: 'required' })
      controller.setAccount('b')
      await expect(held).resolves.toBe(false)
      expect(controller.getState()).toEqual({ status: 'idle' })
      controller.chosen()
      await expect(held).resolves.toBe(false)
    })

    it('signing out drops the screen, and a 403 that arrives after the sign-out does not raise it again', async () => {
      const controller = createLoginIdRequiredController()
      controller.setAccount('a')
      controller.require()
      controller.setAccount(null)
      expect(controller.getState()).toEqual({ status: 'idle' })
      expect(await controller.recover(forbidden())).toBe(false)
      expect(controller.getState()).toEqual({ status: 'idle' })
    })

    it('a controller nobody told about the account still holds calls', () => {
      const controller = createLoginIdRequiredController()
      void controller.recover(forbidden())
      expect(controller.getState()).toEqual({ status: 'required' })
    })
  })
})
