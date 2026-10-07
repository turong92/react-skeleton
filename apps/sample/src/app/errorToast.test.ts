import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { toastUnlessValidation } from './errorToast'

const apiError = (code: string) =>
  new ApiRequestError({ code, title: 't', status: 400, timestamp: 'x' }, 'a', 'b', 'c')

describe('toastUnlessValidation', () => {
  it('lets the form show validation failures itself (no toast)', () => {
    const show = vi.fn()
    toastUnlessValidation(show)(apiError(ErrorCodes.COMMON_VALIDATION_FAILED))
    expect(show).not.toHaveBeenCalled()
  })

  it('also leaves a taken nickname to the field that shows it', () => {
    const show = vi.fn()
    toastUnlessValidation(show)(apiError(ErrorCodes.ACCOUNT_DISPLAY_NAME_TAKEN))
    expect(show).not.toHaveBeenCalled()
  })

  it('leaves the nickname change limit to the field that names the wait', () => {
    const show = vi.fn()
    toastUnlessValidation(show)(apiError(ErrorCodes.ACCOUNT_RATE_LIMITED))
    expect(show).not.toHaveBeenCalled()
  })

  it('toasts every other error', () => {
    const show = vi.fn()
    const error = apiError(ErrorCodes.COMMON_INTERNAL_SERVER_ERROR)
    toastUnlessValidation(show)(error)
    toastUnlessValidation(show)(new Error('network'))
    expect(show).toHaveBeenCalledTimes(2)
    expect(show).toHaveBeenCalledWith(error)
  })
})
