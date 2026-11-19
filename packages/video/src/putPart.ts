import type { PartTarget } from './types'

/** 조각 하나를 올리다 실패 - 네트워크 · 만료 · 저장소 거절. 올리는 쪽이 그 조각만 다시 보낸다 */
export class UploadPartError extends Error {
  readonly part: number
  constructor(part: number) {
    super(`video part ${part} upload failed`)
    this.name = 'UploadPartError'
    this.part = part
  }
}

/** 조각 하나를 보내는 일 - 응답의 `ETag` 를 돌려준다. 시험 · 스토리에서 바꿔 끼운다 */
export type PartPut = (
  target: PartTarget,
  blob: Blob,
  options: { onProgress: (sent: number) => void; signal?: AbortSignal },
) => Promise<string>

/** 브라우저가 스스로 싣는 헤더 - 서명에는 들어 있지만 직접 달면 「unsafe header」 오류가 난다 */
export const FORBIDDEN_HEADERS: ReadonlySet<string> = new Set(['host', 'content-length'])

const aborted = () => new DOMException('aborted', 'AbortError')

/**
 * 서명된 주소로 조각을 직접 `PUT` - 진행률(`upload.onprogress`)은 fetch 가 못 줘서 XHR 로 보낸다(서버 API 가 아니라 저장소로 가는 길).
 * 응답의 `ETag` 를 읽으려면 저장소 CORS 가 `ExposeHeaders: ETag` 를 열어야 한다. 주소는 로그에 남기지 않는다
 */
export const putPartXhr: PartPut = (target, blob, options) =>
  new Promise<string>((resolve, reject) => {
    if (options.signal?.aborted) return reject(aborted())
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const done = () => options.signal?.removeEventListener('abort', abort)
    xhr.open(target.method, target.url)
    for (const [name, value] of Object.entries(target.headers))
      if (!FORBIDDEN_HEADERS.has(name.toLowerCase())) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (event) => options.onProgress(event.loaded)
    xhr.onload = () => {
      done()
      const etag = xhr.getResponseHeader('ETag')
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag)
      else reject(new UploadPartError(target.number))
    }
    xhr.onerror = () => {
      done()
      reject(new UploadPartError(target.number))
    }
    xhr.onabort = () => {
      done()
      reject(aborted())
    }
    options.signal?.addEventListener('abort', abort)
    xhr.send(blob)
  })
