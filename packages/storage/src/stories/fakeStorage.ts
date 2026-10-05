import { UploadAbortedError } from '../errors'
import type { StorageApi } from '../storageApi'
import type { UploadTransport } from '../xhrTransport'

/** 업로드를 흉내 낸다 — presign 은 가짜 주소를, PUT 은 `steps` 번에 나눠 진행률을 보고한다(`stepMs` 간격, 취소 가능) */
export function createFakeStorage({ steps = 10, stepMs = 150 } = {}) {
  const api: StorageApi = {
    presignUpload: async ({ fileName }) => ({
      key: `demo/${fileName}`,
      method: 'PUT',
      url: `https://storage.invalid/demo/${encodeURIComponent(fileName)}`,
      headers: {},
    }),
  }
  const transport: UploadTransport = {
    put: ({ body, signal, onProgress }) =>
      new Promise((resolve, reject) => {
        let sent = 0
        const tick = () => {
          if (signal?.aborted) return reject(new UploadAbortedError())
          sent += 1
          onProgress?.(Math.round((body.size * sent) / steps), body.size)
          if (sent >= steps) return resolve({ status: 200, etag: '"fake-etag"' })
          setTimeout(tick, stepMs)
        }
        setTimeout(tick, stepMs)
      }),
  }
  return { api, transport }
}
