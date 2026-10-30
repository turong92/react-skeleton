import { ApiRequestError, ErrorCodes, isErrorCode } from '@skeleton/api-client'
import type { ReferralRejection } from '../types'

const reasons: readonly string[] = [
  'UNKNOWN_CODE',
  'OWN_CODE',
  'ALREADY_INVITED',
  'MUTUAL',
  'NOT_NEW_ACCOUNT',
]

/** `POST /referrals/claim` 실패 → 거절 이유. 400 은 `data.reason`, 이벤트가 끝났으면(409) `CLOSED`, 모르는 값 · 전송 실패는 `OTHER` */
export function referralRejection(error: unknown): ReferralRejection {
  if (isErrorCode(error, ErrorCodes.CAMPAIGN_NOT_ACTIVE)) return 'CLOSED'
  if (
    error instanceof ApiRequestError &&
    isErrorCode(error, ErrorCodes.CAMPAIGN_REFERRAL_INVALID)
  ) {
    const data = error.apiError.data
    const reason =
      typeof data === 'object' && data !== null ? (data as { reason?: unknown }).reason : undefined
    if (typeof reason === 'string' && reasons.includes(reason)) return reason as ReferralRejection
  }
  return 'OTHER'
}
