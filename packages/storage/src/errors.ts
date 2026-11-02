/**
 * 파일 검증 위반 하나 — 코드는 백엔드 `StorageFileValidationErrorCode` 와 같다:
 * `SIZE_TOO_LARGE` · `UNSUPPORTED_CONTENT_TYPE` · `UNSUPPORTED_EXTENSION`(올리기 전 · presign 단계) ·
 * `CONTENT_MISMATCH` · `UNRECOGNIZED_CONTENT` · `IMAGE_TOO_LARGE` · `INSPECTION_REJECTED`(완료 호출 단계 — 서버가 올라온 내용을 보고 거절)
 */
export type StorageValidationIssue = { code: string; message: string }

/** 올리기 전에 거절됨(클라이언트 규칙 또는 서버 `validate`). 요청은 나가지 않았다 */
export class StorageValidationError extends Error {
  readonly errors: StorageValidationIssue[]

  constructor(errors: StorageValidationIssue[]) {
    super(errors.map((error) => `${error.code}: ${error.message}`).join('; '))
    this.name = 'StorageValidationError'
    this.errors = errors
  }
}

/** 올린 뒤 완료 호출에서 서버가 내용을 보고 거절했다(400 `STORAGE.FILE_REJECTED`). 객체는 서버가 이미 지웠다 — 모양은 {@link StorageValidationError} 와 같다 */
export class UploadRejectedError extends Error {
  readonly errors: StorageValidationIssue[]

  constructor(errors: StorageValidationIssue[]) {
    super(errors.map((error) => `${error.code}: ${error.message}`).join('; '))
    this.name = 'UploadRejectedError'
    this.errors = errors
  }
}

/** 사용자가(또는 새 업로드가) 취소했다 — 실패가 아니다 */
export class UploadAbortedError extends Error {
  constructor() {
    super('Upload aborted')
    this.name = 'UploadAbortedError'
  }
}

/** 저장소(S3 등)가 2xx 가 아닌 답을 했다 — presigned URL 만료(403) · 헤더 불일치 등 */
export class UploadHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Storage responded with HTTP ${status}`)
    this.name = 'UploadHttpError'
    this.status = status
  }
}
