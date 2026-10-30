import { ApiRequestError, ErrorCodes, isErrorCode } from '@skeleton/api-client'

export type WorkspaceProblem =
  | 'slugTaken'
  | 'ownerCannotLeave'
  | 'memberGone'
  | 'notFound'
  | 'forbidden'
  | 'other'

/** 화면이 문장으로 풀어 주는 실패 하나를 한 낱말로 — 나머지는 `other`(일반 문장 + 참조 번호) */
export function workspaceProblem(error: unknown): WorkspaceProblem {
  if (isErrorCode(error, ErrorCodes.WORKSPACE_SLUG_TAKEN)) return 'slugTaken'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_OWNER_CANNOT_LEAVE)) return 'ownerCannotLeave'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_MEMBER_NOT_FOUND)) return 'memberGone'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_NOT_FOUND)) return 'notFound'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_FORBIDDEN)) return 'forbidden'
  return 'other'
}

export type InvitationProblem =
  | 'expired'
  | 'used'
  | 'invalid'
  | 'emailMismatch'
  | 'emailUnverified'
  | 'alreadyMember'
  | 'seatLimit'
  | 'resendTooSoon'
  | 'tooManyPending'
  | 'forbidden'
  | 'other'

/**
 * 죽은 토큰이 왜 죽었는지 — 서버는 토큰을 가진 사람에게만 알려 준다(`data.reason`). 본문이 `detail` 글자로 오면 그것도 읽는다.
 * 모르는 값은 그냥 「유효하지 않은 초대」
 */
function invalidReason(error: ApiRequestError): 'expired' | 'used' | 'invalid' {
  const { data, detail } = error.apiError
  const reason =
    typeof data === 'object' && data !== null && 'reason' in data
      ? (data as { reason: unknown }).reason
      : detail
  if (reason === 'EXPIRED') return 'expired'
  if (reason === 'USED') return 'used'
  return 'invalid'
}

/** 초대 보내기 · 재발송 · 미리보기 · 수락의 실패 하나를 한 낱말로 — 나머지는 `other` */
export function invitationProblem(error: unknown): InvitationProblem {
  if (isErrorCode(error, ErrorCodes.WORKSPACE_INVITATION_INVALID))
    return invalidReason(error as ApiRequestError)
  if (isErrorCode(error, ErrorCodes.WORKSPACE_INVITATION_EMAIL_MISMATCH)) return 'emailMismatch'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_EMAIL_UNVERIFIED)) return 'emailUnverified'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_ALREADY_MEMBER)) return 'alreadyMember'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_SEAT_LIMIT)) return 'seatLimit'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_RESEND_TOO_SOON)) return 'resendTooSoon'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_TOO_MANY_PENDING)) return 'tooManyPending'
  if (isErrorCode(error, ErrorCodes.WORKSPACE_FORBIDDEN)) return 'forbidden'
  return 'other'
}
