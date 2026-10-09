import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { requestedNoticeShown, startWithdraw, withdrawNoticeKey } from './refundFlow'

const apiError = (code: string, status: number) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't' }, 'tr', 'sp', 'tp')

describe('startWithdraw — pressing 「요청 거두기」', () => {
  it('clears the old answer first, then sends that line (an old failure must not sit next to a new try)', () => {
    const order: string[] = []
    const withdraw = {
      reset: vi.fn(() => order.push('reset')),
      mutate: vi.fn((id: string) => order.push(`mutate:${id}`)),
    }
    startWithdraw(withdraw, { id: 'rfd_7' })
    expect(order).toEqual(['reset', 'mutate:rfd_7'])
  })
})

describe('withdrawNoticeKey — what is said under the summary when taking the request back did not work', () => {
  it('says nothing while it works or after it worked', () => {
    expect(withdrawNoticeKey({ isError: false, error: null })).toBeNull()
  })

  it('a decided request (409 / 404) says it was decided; an unknown result says to press again', () => {
    expect(
      withdrawNoticeKey({ isError: true, error: apiError('PAYMENT.REFUND_NOT_ALLOWED', 409) }),
    ).toBe('cheer.detail.withdrawDecided')
    expect(withdrawNoticeKey({ isError: true, error: new Error('network') })).toBe(
      'cheer.detail.withdrawFailed',
    )
  })
})

describe('requestedNoticeShown — 「환불 요청함」 under a stale screen', () => {
  const request = { isSuccess: true, data: { id: 'rfd_new' } }
  const idle = { isSuccess: false, data: undefined }
  const listed = (...ids: string[]) => ids.map((id) => ({ id }))

  it('says it right after the request went through, but only while the re-read has failed', () => {
    expect(requestedNoticeShown({ refreshFailed: true, request, refunds: [] })).toBe(true)
    expect(requestedNoticeShown({ refreshFailed: false, request, refunds: [] })).toBe(false)
    expect(requestedNoticeShown({ refreshFailed: true, request: idle, refunds: [] })).toBe(false)
  })

  it('goes quiet once the list has the line (whatever became of it: decided by the operator, taken back, refunded) - the line speaks, not an old notice (R2-m3)', () => {
    // 요청 성공 → 운영자가 환불/거절 → 재조회 성공(줄이 목록에 있다) → 나중의 재조회 실패
    expect(
      requestedNoticeShown({ refreshFailed: true, request, refunds: listed('rfd_old', 'rfd_new') }),
    ).toBe(false)
  })

  it('a line the list does not have yet is still said (the re-read that would show it failed)', () => {
    expect(requestedNoticeShown({ refreshFailed: true, request, refunds: listed('rfd_old') })).toBe(
      true,
    )
  })

  it('a new request after an old one that is listed says it again (it is another line)', () => {
    expect(
      requestedNoticeShown({
        refreshFailed: true,
        request: { isSuccess: true, data: { id: 'rfd_second' } },
        refunds: listed('rfd_new'),
      }),
    ).toBe(true)
  })
})
