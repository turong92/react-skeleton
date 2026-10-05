import { StorageValidationError, UploadAbortedError } from './errors'
import type { PublicUrlResolver, StorageApi, StorageCandidate, CompletedPart } from './storageApi'
import { validateFile, type StorageFileRules } from './validateFile'
import { createXhrTransport, type UploadTransport } from './xhrTransport'

export type UploadProgress = { loaded: number; total: number; fraction: number }

export type UploadResult = {
  /** 저장소의 객체 키 — 서버에 이 값을 알려 파일과 레코드를 잇는다 */
  key: string
  /** `publicUrl` 옵션이 있고 주소가 있으면 */
  publicUrl: string | null
  etag: string | null
  multipart: boolean
}

export type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

export type Uploader = { upload(file: File, options?: UploadOptions): Promise<UploadResult> }

export type MultipartOptions = {
  /** 이보다 큰 파일만 멀티파트(기본 16 MiB). `api.multipart` 가 없으면 항상 단일 PUT */
  thresholdBytes?: number
  /** 한 조각 크기(기본 8 MiB). S3 는 마지막 조각 말고는 5 MiB 이상을 요구한다 */
  partSizeBytes?: number
  /** 동시에 올릴 조각 수(기본 3) */
  concurrency?: number
  /** 조각 수 한도(기본 10,000 — 백엔드 `requireValidPartNumber`). 넘으면 조각을 키운다 */
  maxParts?: number
}

export type UploaderOptions = {
  api: StorageApi
  transport?: UploadTransport
  /** 올리기 전 클라이언트 검사(편의 — 경계는 서버) */
  rules?: StorageFileRules
  multipart?: MultipartOptions
  /** 키 → 공개 주소(`publicUrlFromBase` · `publicUrlFromEndpoint` · 직접) */
  publicUrl?: PublicUrlResolver
}

const MIB = 1024 * 1024

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new UploadAbortedError()
}

/**
 * 업로드 흐름: 검증(클라이언트 규칙 → 서버 `validate`) → presign → 브라우저가 저장소로 직접 PUT(진행률 · 취소)
 * → 객체 키(+ 공개 주소). 큰 파일은 멀티파트(조각 presign → 조각 PUT → complete, 실패 · 취소 시 서버에 abort).
 * 업로드 자체는 앱 서버를 거치지 않는다 — 앱 서버는 presign 만 내준다.
 */
export function createUploader({
  api,
  transport = createXhrTransport(),
  rules = {},
  multipart = {},
  publicUrl,
}: UploaderOptions): Uploader {
  const thresholdBytes = multipart.thresholdBytes ?? 16 * MIB
  const partSizeBytes = multipart.partSizeBytes ?? 8 * MIB
  const concurrency = Math.max(1, multipart.concurrency ?? 3)
  const maxParts = multipart.maxParts ?? 10_000

  async function finish(
    key: string,
    etag: string | null,
    viaMultipart: boolean,
  ): Promise<UploadResult> {
    return {
      key,
      publicUrl: publicUrl ? await publicUrl(key) : null,
      etag,
      multipart: viaMultipart,
    }
  }

  async function single(file: File, candidate: StorageCandidate, options: UploadOptions) {
    const presigned = await api.presignUpload(candidate)
    throwIfAborted(options.signal)
    const response = await transport.put({
      url: presigned.url,
      method: presigned.method,
      headers: presigned.headers,
      body: file,
      signal: options.signal,
      onProgress: (loaded, total) =>
        options.onProgress?.({ loaded, total, fraction: total > 0 ? loaded / total : 1 }),
    })
    options.onProgress?.({ loaded: file.size, total: file.size, fraction: 1 })
    return finish(presigned.key, response.etag, false)
  }

  async function multipartUpload(
    file: File,
    candidate: StorageCandidate,
    options: UploadOptions,
    parts: NonNullable<StorageApi['multipart']>,
  ) {
    const partSize = Math.max(partSizeBytes, Math.ceil(file.size / maxParts))
    const count = Math.ceil(file.size / partSize)
    const started = await parts.start(candidate)
    const inner = new AbortController()
    const onOuterAbort = () => inner.abort()
    options.signal?.addEventListener('abort', onOuterAbort, { once: true })
    const loadedByPart = new Array<number>(count).fill(0)
    const report = () => {
      const loaded = loadedByPart.reduce((sum, n) => sum + n, 0)
      options.onProgress?.({
        loaded,
        total: file.size,
        fraction: file.size > 0 ? loaded / file.size : 1,
      })
    }
    const completed: CompletedPart[] = new Array(count)
    let next = 0
    let failure: unknown = null

    const worker = async () => {
      while (failure === null && next < count) {
        const index = next
        next += 1
        const blob = file.slice(index * partSize, Math.min(file.size, (index + 1) * partSize))
        try {
          throwIfAborted(inner.signal)
          const part = await parts.presignPart({
            key: started.key,
            uploadId: started.uploadId,
            partNumber: index + 1,
            contentLength: blob.size,
          })
          const response = await transport.put({
            url: part.url,
            method: part.method,
            headers: part.headers,
            body: blob,
            signal: inner.signal,
            onProgress: (loaded) => {
              loadedByPart[index] = loaded
              report()
            },
          })
          if (!response.etag)
            throw new Error(
              `The storage response for part ${index + 1} has no ETag header — expose it in the bucket CORS (ExposeHeaders: ETag)`,
            )
          loadedByPart[index] = blob.size
          report()
          completed[index] = { partNumber: index + 1, eTag: response.etag }
        } catch (error) {
          if (failure === null) {
            failure = error
            inner.abort()
          }
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker))
      if (options.signal?.aborted) throw new UploadAbortedError()
      if (failure !== null) throw failure
      const result = (await parts.complete({
        key: started.key,
        uploadId: started.uploadId,
        parts: completed,
      })) as { eTag?: string | null } | undefined
      return await finish(started.key, result?.eTag ?? null, true)
    } catch (error) {
      await Promise.resolve(parts.abort({ key: started.key, uploadId: started.uploadId })).catch(
        () => {},
      )
      throw options.signal?.aborted ? new UploadAbortedError() : error
    } finally {
      options.signal?.removeEventListener('abort', onOuterAbort)
    }
  }

  return {
    async upload(file, options = {}) {
      throwIfAborted(options.signal)
      const issues = validateFile(file, rules)
      if (issues.length > 0) throw new StorageValidationError(issues)
      const candidate: StorageCandidate = {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      }
      if (api.validate) {
        const remote = await api.validate(candidate)
        if (remote.length > 0) throw new StorageValidationError(remote)
      }
      throwIfAborted(options.signal)
      const parts = api.multipart
      return parts && file.size > thresholdBytes
        ? multipartUpload(file, candidate, options, parts)
        : single(file, candidate, options)
    },
  }
}
