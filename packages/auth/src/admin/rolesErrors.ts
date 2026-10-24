import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import type { AdminRolesLabels } from './rolesLabels'

/** 역할 관리 호출의 실패를 화면에 보일 한 문장으로 - `AUTHZ.*` 코드마다 문구, 모르는 것은 일반 문구 */
export function roleErrorMessage(error: unknown, labels: AdminRolesLabels): string {
  if (!(error instanceof ApiRequestError)) return labels.errors.generic
  const e = labels.errors
  switch (error.apiError.code) {
    case ErrorCodes.AUTHZ_ROLE_PROTECTED:
      return e.protected
    case ErrorCodes.AUTHZ_ROLE_IN_USE:
      return e.inUse
    case ErrorCodes.AUTHZ_ROLE_EXISTS:
      return e.exists
    case ErrorCodes.AUTHZ_ROLE_NOT_FOUND:
      return e.notFound
    case ErrorCodes.AUTHZ_PERMISSION_UNKNOWN:
      return e.permissionUnknown
    case ErrorCodes.AUTHZ_ESCALATION:
      return e.escalation
    case ErrorCodes.AUTHZ_SELF_LOCKOUT:
      return e.selfLockout
    case ErrorCodes.COMMON_VALIDATION_FAILED:
      return e.validation
    default:
      return e.generic
  }
}

/** 이 오류가 「그 역할이 없다」 - 목록이 낡았으니 다시 읽는다 */
export const isRoleGone = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.code === ErrorCodes.AUTHZ_ROLE_NOT_FOUND
