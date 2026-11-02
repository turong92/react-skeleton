import {
  createStorageApi,
  createUploader,
  publicUrlFromDownload,
  storageEndpoints,
} from '@skeleton/storage'
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

/** 비회원 업로드(백엔드 `skeleton.storage.web.guest.*`) - 이미지 넷만, 10 MB까지, SVG 불가. 발급 경로만 다르고 올리는 길은 같다 */
export const GUEST_ATTACHMENT_RULES = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedContentTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
}

/** 로그인하지 않은 사람의 발급 - 다운로드 주소는 받지 못한다(내려받기는 로그인이 필요하다) */
export const guestStorageApi = createStorageApi(apiClient, {
  presign: '/storage/guest/presign',
  complete: storageEndpoints().guestComplete,
})

export const guestUploader = createUploader({
  api: guestStorageApi,
  rules: GUEST_ATTACHMENT_RULES,
  complete: true, // 서버가 올라온 내용을 보고 거절할 수 있다 - 비회원 경로의 완료 호출
})

export const uploader = createUploader({
  api: storageApi,
  rules: ATTACHMENT_RULES,
  publicUrl: publicUrlFromDownload(storageApi),
  complete: true, // 올린 뒤 서버 검사(이미지면 변환을 시작한다) - 서버가 이 경로를 열지 않으면 끈다
})
