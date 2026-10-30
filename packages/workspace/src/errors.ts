import { ErrorCodes, isErrorCode } from '@skeleton/api-client'

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
