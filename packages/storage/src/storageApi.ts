import type { ApiClient } from '@skeleton/api-client'
import type { StorageValidationIssue } from './errors'

/*
 * 백엔드 `modules/storage` 가 `/api/v1/storage/*` 를 연다(`StorageController` — presign · presign-download · validate · multipart).
 * 기본 경로(`storageEndpoints()`)가 그것이라 `createStorageApi(client)` 한 줄이면 된다. 앱이 컨트롤러를 따로 열었다면
 * `storageEndpoints('/files')` 로 뿌리를 바꾸거나 `endpoints` 를 직접 준다. 본문 · 응답은 그 컨트롤러의 DTO 모양이다
 * (단건 envelope `{ value, meta }` — 앱의 컨트롤러도 `Response.ok(…)` 로 돌려준다).
 */

/** 올릴 파일의 요약 — 백엔드 `StorageFileCandidate`. 키는 서버가 정한다(클라이언트가 고르지 않는다) */
export type StorageCandidate = { fileName: string; contentType: string; sizeBytes: number }

/** 백엔드 `PresignedUrl`(`expiresAt` 은 쓰지 않는다) */
export type PresignedUpload = {
  key: string
  method: string
  url: string
  headers: Record<string, string>
}

export type PresignedPart = PresignedUpload & { uploadId: string; partNumber: number }

export type StartedUpload = { key: string; uploadId: string }
export type CompletedPart = { partNumber: number; eTag: string }

export type StorageEndpoints = {
  /** `POST` {@link StorageCandidate} → `PresignedUrl` */
  presign: string
  /** `POST { key }` → `PresignedUrl`(GET) — 비공개 버킷의 내려받기 주소. 있으면 `api.presignDownload` */
  download?: string
  /** `POST` {@link StorageCandidate} → `{ valid, errors: [{ code, message }] }`(kotlin-skeleton workbench 의 `/skeleton/storage/validate` 와 같은 모양) */
  validate?: string
  /** 멀티파트를 쓰려면 네 개 모두 */
  multipart?: { start: string; part: string; complete: string; abort: string }
  /** `POST { key }` → {@link UploadInspection} — 올린 뒤 서버가 내용을 검사한다. 있으면 `api.complete` */
  complete?: string
  /** `complete` 의 비회원 경로(비회원 업로드를 켠 서버만). 비회원 업로더는 이것을 `complete` 로 준다 */
  guestComplete?: string
  /** `POST { keys }` → `{ items }`(이미지 모듈이 있는 서버만). 있으면 `api.images` */
  images?: string
}

/** 서버가 정한 이미지 처리 상태 — `PENDING` 변환 중 · `READY` · `REJECTED` · `UNSUPPORTED`(미리보기를 못 만드는 형식) · `FAILED` */
export type ImageStatus = 'PENDING' | 'READY' | 'REJECTED' | 'UNSUPPORTED' | 'FAILED'

/** 완료 응답의 이미지 부분 — 이미지가 아니거나 이미지 모듈이 없는 서버면 {@link UploadInspection} 의 `image` 가 `null` */
export type ImageInspection = {
  status: ImageStatus
  width?: number
  height?: number
}

/** 완료 호출의 응답 — `contentType` 은 서버가 내용으로 판정한 형식. PDF 키에도 `image`(1쪽 썸네일 상태)가 올 수 있다 */
export type UploadInspection = {
  key: string
  contentType: string
  sizeBytes: number
  image: ImageInspection | null
}

/** 변환본 하나(`thumb` · `display`) — 주소는 서명 또는 공개 주소 */
export type ImageVariant = { url: string; width?: number; height?: number }

/** `images` 의 한 줄 — 서버의 `variants: { thumb?, display? }` 를 펼친 모양(`StoredImage` 가 바로 받는다) */
export type StoredImageItem = {
  key: string
  status: ImageStatus
  width?: number
  height?: number
  thumb?: ImageVariant
  display?: ImageVariant
}

export type MultipartApi = {
  /** `POST` {@link StorageCandidate} → `StartedMultipartUpload` */
  start(candidate: StorageCandidate): Promise<StartedUpload>
  /** `POST { key, uploadId, partNumber, contentLength }` → `PresignedMultipartUploadPart` */
  presignPart(request: {
    key: string
    uploadId: string
    partNumber: number
    contentLength: number
  }): Promise<PresignedPart>
  /** `POST { key, uploadId, parts: [{ partNumber, eTag }] }` → `CompletedMultipartUpload` */
  complete(request: { key: string; uploadId: string; parts: CompletedPart[] }): Promise<unknown>
  /** `POST { key, uploadId }` */
  abort(request: { key: string; uploadId: string }): Promise<unknown>
}

export type StorageApi = {
  presignUpload(candidate: StorageCandidate): Promise<PresignedUpload>
  /** 비공개 객체의 짧은 수명 내려받기 주소(`endpoints.download` 가 있을 때만) */
  presignDownload?(key: string): Promise<string>
  /** 서버 검증 — 위반 목록(비면 통과). `endpoints.validate` 가 있을 때만 */
  validate?(candidate: StorageCandidate): Promise<StorageValidationIssue[]>
  /** `endpoints.multipart` 가 있을 때만 */
  multipart?: MultipartApi
  /** 업로드 완료 호출 — 서버가 올라온 내용을 검사한다(거절이면 400 `STORAGE.FILE_REJECTED` 를 던진다). `endpoints.complete` 가 있을 때만 */
  complete?(key: string): Promise<UploadInspection>
  /** 내 키들의 이미지 상태 · 변환본(20개까지). `endpoints.images` 가 있을 때만 */
  images?(keys: string[]): Promise<StoredImageItem[]>
}

type Raw = Record<string, unknown>

/** Kotlin `ObjectKey(val value)` 는 `{ value }` 로도, 글자로도 직렬화될 수 있다 */
function keyOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  const value = (raw as Raw | null)?.value
  if (typeof value === 'string') return value
  throw new Error('storage response has no object key')
}

function presigned(raw: Raw): PresignedUpload {
  return {
    key: keyOf(raw.key),
    method: typeof raw.method === 'string' ? raw.method : 'PUT',
    url: String(raw.url),
    headers: (raw.headers as Record<string, string> | undefined) ?? {},
  }
}

/** 백엔드 `modules/storage` 의 기본 경로 전부(클라이언트 baseUrl 기준 — 보통 `/api/v1`). 뿌리를 바꾸려면 `basePath` */
export function storageEndpoints(basePath = '/storage'): Required<StorageEndpoints> {
  const base = basePath.replace(/\/+$/, '')
  return {
    presign: `${base}/presign`,
    validate: `${base}/validate`,
    download: `${base}/presign-download`,
    multipart: {
      start: `${base}/multipart/start`,
      part: `${base}/multipart/part`,
      complete: `${base}/multipart/complete`,
      abort: `${base}/multipart/abort`,
    },
    complete: `${base}/complete`,
    guestComplete: `${base}/guest/complete`,
    images: `${base}/images`,
  }
}

/** presign 엔드포인트를 부르는 얇은 호출 모음(기본은 백엔드 모듈의 경로). 인증은 클라이언트의 `getAuthHeaders` */
export function createStorageApi(
  client: Pick<ApiClient, 'value'>,
  endpoints: StorageEndpoints = storageEndpoints(),
): StorageApi {
  const post = <T>(path: string, json: unknown) => client.value<T>(path, { method: 'POST', json })
  const api: StorageApi = {
    presignUpload: async (candidate) => presigned(await post<Raw>(endpoints.presign, candidate)),
  }
  if (endpoints.download) {
    const path = endpoints.download
    api.presignDownload = async (key) => presigned(await post<Raw>(path, { key })).url
  }
  if (endpoints.validate) {
    const path = endpoints.validate
    api.validate = async (candidate) => {
      const result = await post<{ errors?: StorageValidationIssue[] }>(path, candidate)
      return result.errors ?? []
    }
  }
  if (endpoints.multipart) {
    const { start, part, complete, abort } = endpoints.multipart
    api.multipart = {
      start: async (candidate) => {
        const raw = await post<Raw>(start, candidate)
        return { key: keyOf(raw.key), uploadId: String(raw.uploadId) }
      },
      presignPart: async (request) => {
        const raw = await post<Raw>(part, request)
        return {
          ...presigned(raw),
          uploadId: String(raw.uploadId ?? request.uploadId),
          partNumber: Number(raw.partNumber ?? request.partNumber),
        }
      },
      complete: (request) => post(complete, request),
      abort: (request) => post(abort, request),
    }
  }
  if (endpoints.complete) {
    const path = endpoints.complete
    api.complete = async (key) => {
      const raw = await post<Raw>(path, { key })
      return {
        key: keyOf(raw.key),
        contentType: String(raw.contentType),
        sizeBytes: Number(raw.sizeBytes),
        image: raw.image ? imageInspection(raw.image as Raw) : null,
      }
    }
  }
  if (endpoints.images) {
    const path = endpoints.images
    api.images = async (keys) => {
      const result = await post<{ items?: Raw[] }>(path, { keys })
      return (result.items ?? []).map(storedImageItem)
    }
  }
  return api
}

const sized = (raw: Raw) => ({
  ...(typeof raw.width === 'number' && { width: raw.width }),
  ...(typeof raw.height === 'number' && { height: raw.height }),
})

function imageInspection(raw: Raw): ImageInspection {
  return { status: raw.status as ImageStatus, ...sized(raw) }
}

function variantOf(raw: unknown): ImageVariant | undefined {
  const variant = raw as Raw | undefined
  return variant && typeof variant.url === 'string'
    ? { url: variant.url, ...sized(variant) }
    : undefined
}

function storedImageItem(raw: Raw): StoredImageItem {
  const variants = (raw.variants ?? {}) as Raw
  const thumb = variantOf(variants.thumb)
  const display = variantOf(variants.display)
  return {
    key: keyOf(raw.key),
    status: raw.status as ImageStatus,
    ...sized(raw),
    ...(thumb && { thumb }),
    ...(display && { display }),
  }
}

export type PublicUrlResolver = (key: string) => string | null | Promise<string | null>

/** CDN 주소 + 키(각 구간을 인코딩) — 저장소가 `RAW` 공개 URL 일 때 */
export function publicUrlFromBase(baseUrl: string): PublicUrlResolver {
  const base = baseUrl.replace(/\/+$/, '')
  return (key) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * 서버에 묻는다: `GET <path>?key=` → `{ key, publicUrl, available }`(kotlin-skeleton workbench 의 `/skeleton/storage/public-url`).
 * OPAQUE 공개 URL 처럼 서버만 만들 수 있는 주소에 쓴다.
 */
export function publicUrlFromEndpoint(
  client: Pick<ApiClient, 'value'>,
  path: string,
): PublicUrlResolver {
  return async (key) => {
    const result = await client.value<{ publicUrl: string | null }>(path, { params: { key } })
    return result.publicUrl ?? null
  }
}

/**
 * 키 → 내려받기 주소를 서버에 presign 시켜 받는다 — 비공개 버킷(기본)에서 업로드한 파일을 바로 열 때.
 * 주소는 만료된다(백엔드 `presign.download`, 기본 10분) — 오래 들고 있지 말고 필요할 때 다시 부른다.
 */
export function publicUrlFromDownload(api: Pick<StorageApi, 'presignDownload'>): PublicUrlResolver {
  const presignDownload = api.presignDownload
  if (!presignDownload) throw new Error('storage api has no download endpoint (endpoints.download)')
  return (key) => presignDownload(key)
}
