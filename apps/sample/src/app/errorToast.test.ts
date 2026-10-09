import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { PAYMENT_LEDGER_ERROR_CODES, RefundRequestNotOpenError } from '@skeleton/payment'
import { RefundNotDoneError } from '@skeleton/payment/admin'
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

  it('lets the payment screens speak for every PAYMENT.* error in their own words (the server wording never reaches a toast)', () => {
    const show = vi.fn()
    for (const code of [
      ...PAYMENT_LEDGER_ERROR_CODES,
      ErrorCodes.PAYMENT_PROVIDER_ERROR,
      ErrorCodes.PAYMENT_ROUTING_FAILED,
    ])
      toastUnlessValidation(show)(apiError(code))
    expect(show).not.toHaveBeenCalled()
  })

  it('a refund line that came back closed (RefundNotDoneError, an English sentence made for logs) is told by the refund window in place, never by a toast', () => {
    const show = vi.fn()
    const line = {
      id: 'rfd_1',
      orderId: 'ord_1',
      status: 'FAILED' as const,
      amount: { amount: 1000, currency: 'KRW' },
      reasonCode: 'OPERATOR',
      origin: 'OPERATOR' as const,
      requestedAt: 't',
      completedAt: null,
      closedBy: null,
    }
    toastUnlessValidation(show)(new RefundNotDoneError(line))
    expect(show).not.toHaveBeenCalled()
  })

  it('a refund request that came back closed (RefundRequestNotOpenError, an English sentence made for logs) is told by the request window in place, never by a toast', () => {
    const show = vi.fn()
    const line = {
      id: 'rfd_1',
      orderId: 'ord_1',
      status: 'REJECTED' as const,
      amount: { amount: 1000, currency: 'KRW' },
      reasonCode: 'CUSTOMER_REQUEST',
      origin: 'USER' as const,
      requestedAt: 't',
      completedAt: null,
      closedBy: null,
    }
    toastUnlessValidation(show)(new RefundRequestNotOpenError(line))
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
