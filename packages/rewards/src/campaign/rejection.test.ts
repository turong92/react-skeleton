import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { referralRejection } from './rejection'

const error = (status: number, code: string, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, data } as never, 't', 's', 'p')

describe('referralRejection', () => {
  it.each(['UNKNOWN_CODE', 'OWN_CODE', 'ALREADY_INVITED', 'MUTUAL', 'NOT_NEW_ACCOUNT'])(
    'reads data.reason %s from CAMPAIGN.REFERRAL_INVALID',
    (reason) => {
      expect(referralRejection(error(400, 'CAMPAIGN.REFERRAL_INVALID', { reason }))).toBe(reason)
    },
  )

  it('maps CAMPAIGN.NOT_ACTIVE to CLOSED', () => {
    expect(referralRejection(error(409, 'CAMPAIGN.NOT_ACTIVE'))).toBe('CLOSED')
  })

  it('falls back to OTHER for an unknown reason, a missing reason or a non-API error', () => {
    expect(referralRejection(error(400, 'CAMPAIGN.REFERRAL_INVALID', { reason: 'NEW_ONE' }))).toBe(
      'OTHER',
    )
    expect(referralRejection(error(400, 'CAMPAIGN.REFERRAL_INVALID'))).toBe('OTHER')
    expect(referralRejection(new Error('network'))).toBe('OTHER')
  })
})
