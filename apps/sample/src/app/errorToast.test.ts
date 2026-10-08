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

  it('lets the profile form speak for its own AUTHOR_PROFILE.* errors (no second message in a toast)', () => {
    const show = vi.fn()
    for (const code of [
      ErrorCodes.AUTHOR_PROFILE_NAME_TAKEN,
      ErrorCodes.AUTHOR_PROFILE_LIMIT_REACHED,
      ErrorCodes.AUTHOR_PROFILE_RATE_LIMITED,
      ErrorCodes.AUTHOR_PROFILE_NOT_FOUND,
    ])
      toastUnlessValidation(show)(apiError(code))
    expect(show).not.toHaveBeenCalled()
  })

  it('leaves ACCOUNT.EMAIL_REQUIRED to the full-screen "register your email" step (no toast from a query or a mutation)', () => {
    const show = vi.fn()
    const blocked = new ApiRequestError(
      { code: ErrorCodes.ACCOUNT_EMAIL_REQUIRED, title: 't', status: 403, timestamp: 'x' },
      'a',
      'b',
      'c',
    )
    toastUnlessValidation(show)(blocked)
    expect(show).not.toHaveBeenCalled()
  })

  it('leaves ACCOUNT.LOGIN_ID_REQUIRED to the full-screen "choose your ID" step (no toast from a query or a mutation)', () => {
    const show = vi.fn()
    const blocked = new ApiRequestError(
      { code: ErrorCodes.ACCOUNT_LOGIN_ID_REQUIRED, title: 't', status: 403, timestamp: 'x' },
      'a',
      'b',
      'c',
    )
    toastUnlessValidation(show)(blocked)
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
