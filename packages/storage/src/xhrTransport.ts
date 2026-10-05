import { UploadAbortedError, UploadHttpError } from './errors'

export type PutRequest = {
  url: string
  method: string
  headers: Record<string, string>
  body: Blob
  signal?: AbortSignal
  /** 보낸 바이트 / 전체 바이트(계산 가능할 때만 불린다) */
  onProgress?: (loaded: number, total: number) => void
}

export type PutResponse = { status: number; etag: string | null }

/** 파일 한 덩어리를 presigned URL 로 보내는 일 — 테스트에서 가짜로 바꾼다 */
export type UploadTransport = { put(request: PutRequest): Promise<PutResponse> }

/** 브라우저가 스스로 정하는 헤더 — 넣으면 `setRequestHeader` 가 거절한다 */
const FORBIDDEN = new Set(['content-length', 'host'])

/** `XMLHttpRequest` 로 보낸다(fetch 는 업로드 진행률이 없다). 생성자를 바꿔 끼울 수 있다(테스트) */
export function createXhrTransport(
  Xhr: typeof XMLHttpRequest = globalThis.XMLHttpRequest,
): UploadTransport {
  return {
    put: ({ url, method, headers, body, signal, onProgress }) =>
      new Promise<PutResponse>((resolve, reject) => {
        if (signal?.aborted) return reject(new UploadAbortedError())
        const xhr = new Xhr()
        const cleanup = () => signal?.removeEventListener('abort', onAbort)
        const onAbort = () => xhr.abort()
        xhr.open(method, url)
        for (const [name, value] of Object.entries(headers))
          if (!FORBIDDEN.has(name.toLowerCase())) xhr.setRequestHeader(name, value)
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress?.(event.loaded, event.total)
        }
        xhr.onload = () => {
          cleanup()
          if (xhr.status >= 200 && xhr.status < 300)
            resolve({ status: xhr.status, etag: xhr.getResponseHeader('ETag') })
          else reject(new UploadHttpError(xhr.status))
        }
        xhr.onerror = () => {
          cleanup()
          reject(new Error('Network error while uploading'))
        }
        xhr.onabort = () => {
          cleanup()
          reject(new UploadAbortedError())
        }
        signal?.addEventListener('abort', onAbort, { once: true })
        xhr.send(body)
      }),
  }
}
