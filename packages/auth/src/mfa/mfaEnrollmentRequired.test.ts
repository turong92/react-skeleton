import { describe, expect, it } from 'vitest'
import { apiError } from '../test/apiFixtures'
import {
  createMfaEnrollmentRequiredController,
  isMfaEnrollmentRequiredError,
} from './mfaEnrollmentRequired'

const forbidden = (code = 'MFA.ENROLLMENT_REQUIRED', path = '/notes') => ({
  path,
  method: 'GET',
  error: apiError(code, 403),
})

describe('isMfaEnrollmentRequiredError', () => {
  it('is the 403 MFA.ENROLLMENT_REQUIRED and nothing else', () => {
    expect(isMfaEnrollmentRequiredError(apiError('MFA.ENROLLMENT_REQUIRED', 403))).toBe(true)
    expect(isMfaEnrollmentRequiredError(apiError('COMMON.FORBIDDEN', 403))).toBe(false)
    expect(isMfaEnrollmentRequiredError(apiError('MFA.ENROLLMENT_REQUIRED', 400))).toBe(false)
    expect(isMfaEnrollmentRequiredError(new Error('x'))).toBe(false)
  })
})

describe('createMfaEnrollmentRequiredController', () => {
  it('ignores every other 403', async () => {
    const controller = createMfaEnrollmentRequiredController()
    expect(await controller.recover(forbidden('ACCOUNT.EMAIL_REQUIRED'))).toBe(false)
    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('holds the call behind the screen and replays it once two-step is on', async () => {
    const controller = createMfaEnrollmentRequiredController()
    const waiting = controller.recover(forbidden())
    expect(controller.getState()).toEqual({ status: 'required' })
    controller.enrolled()
    await expect(waiting).resolves.toBe(true)
    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('leaving releases the held call with false (it ends as the original 403)', async () => {
    const controller = createMfaEnrollmentRequiredController()
    const waiting = controller.recover(forbidden())
    controller.decline()
    await expect(waiting).resolves.toBe(false)
  })

  it('a 403 that arrives after sign-out does not raise the screen', async () => {
    const controller = createMfaEnrollmentRequiredController()
    controller.setAccount(null)
    expect(await controller.recover(forbidden())).toBe(false)
    expect(controller.getState()).toEqual({ status: 'idle' })
  })
})
