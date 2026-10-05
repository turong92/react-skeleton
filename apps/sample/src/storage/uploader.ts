import { createStorageApi, createUploader, publicUrlFromDownload } from '@skeleton/storage'
import { apiClient } from '../api/client'

/** 백엔드 sample 의 `skeleton.storage.validation` 과 같은 규칙 — 사용자에게 빨리 알리는 편의일 뿐 경계는 서버다 */
export const ATTACHMENT_RULES = {
  maxSizeBytes: 5 * 1024 * 1024,
  allowedContentTypes: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
  ],
}

/** `accept` 속성용 */
export const ATTACHMENT_ACCEPT = ATTACHMENT_RULES.allowedContentTypes.join(',')

export const storageApi = createStorageApi(apiClient)

export const uploader = createUploader({
  api: storageApi,
  rules: ATTACHMENT_RULES,
  publicUrl: publicUrlFromDownload(storageApi),
})
