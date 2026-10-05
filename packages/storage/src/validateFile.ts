import type { StorageValidationIssue } from './errors'

/** 백엔드 `StorageFileValidationRule` 과 같은 규칙. 비어 있는 항목은 검사하지 않는다 */
export type StorageFileRules = {
  maxSizeBytes?: number
  /** `image/png` 또는 `image/*` — 대소문자 무시 */
  allowedContentTypes?: readonly string[]
  /** `png` 또는 `.png` — 대소문자 무시 */
  allowedExtensions?: readonly string[]
}

/**
 * 올리기 전 검사 — 백엔드 `StorageFileValidator`(modules/storage)와 같은 의미 · 같은 코드.
 * 이것은 사용자에게 빨리 알려 주는 편의다. 보안 경계는 서버(presign 을 내줄 때의 검증)다.
 */
export function validateFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  rules: StorageFileRules,
): StorageValidationIssue[] {
  const errors: StorageValidationIssue[] = []
  if (rules.maxSizeBytes !== undefined && file.size > rules.maxSizeBytes)
    errors.push({
      code: 'SIZE_TOO_LARGE',
      message: `File size ${file.size} exceeds maximum ${rules.maxSizeBytes}.`,
    })
  if (
    rules.allowedContentTypes?.length &&
    !contentTypeAllowed(file.type, rules.allowedContentTypes)
  )
    errors.push({
      code: 'UNSUPPORTED_CONTENT_TYPE',
      message: `Content type '${file.type}' is not allowed.`,
    })
  if (rules.allowedExtensions?.length && !extensionAllowed(file.name, rules.allowedExtensions))
    errors.push({
      code: 'UNSUPPORTED_EXTENSION',
      message: `File extension for '${file.name}' is not allowed.`,
    })
  return errors
}

function contentTypeAllowed(contentType: string, allowed: readonly string[]): boolean {
  const normalized = contentType.toLowerCase().trim()
  if (!normalized) return false
  return allowed.some((entry) => {
    const candidate = entry.toLowerCase().trim()
    return (
      candidate === normalized ||
      (candidate.endsWith('/*') && normalized.startsWith(candidate.slice(0, -1)))
    )
  })
}

function extensionAllowed(fileName: string, allowed: readonly string[]): boolean {
  const dot = fileName.lastIndexOf('.')
  const extension =
    dot < 0
      ? ''
      : fileName
          .slice(dot + 1)
          .toLowerCase()
          .trim()
  if (!extension || extension === fileName.toLowerCase()) return false
  return allowed.some((entry) => entry.replace(/^\./, '').toLowerCase().trim() === extension)
}
