import { ApiRequestError, ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { StorageValidationError } from '@skeleton/storage'
import { i18n } from '../i18n'

/** 서버가 거절하면 사유 코드는 `apiError.data.errors[].code` 에, 브라우저 규칙이면 `StorageValidationError.errors` 에 있다 */
function codesOf(error: unknown): string[] {
  if (error instanceof StorageValidationError) return error.errors.map((issue) => issue.code)
  if (error instanceof ApiRequestError && isErrorCode(error, ErrorCodes.STORAGE_FILE_REJECTED)) {
    const data = error.apiError.data as { errors?: Array<{ code?: string }> } | null | undefined
    return (data?.errors ?? []).map((issue) => issue.code ?? '')
  }
  return []
}

/** 업로드 오류 → 사용자 문구(지금 화면 언어). 오류가 없으면 `undefined` */
export function uploadErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined
  const codes = codesOf(error)
  if (codes.includes('SIZE_TOO_LARGE')) return i18n.t('attachment.tooLarge')
  if (codes.includes('UNSUPPORTED_CONTENT_TYPE') || codes.includes('UNSUPPORTED_EXTENSION'))
    return i18n.t('attachment.unsupported')
  return i18n.t('attachment.failed')
}
