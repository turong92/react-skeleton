import { ApiRequestError } from '@skeleton/api-client'
import { UploadAbortedError } from '../errors'
import type { StorageApi, StoredImageItem } from '../storageApi'
import type { UploadTransport } from '../xhrTransport'

/** 1x1 PNG — 스토리의 「고른 사진」 */
export const TINY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

/** 서버가 줄 변환본 대신 쓰는 단색 그림(데이터 주소) */
const swatch = (color: string, width: number, height: number) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`)}`

export const fakeStoredImage = (key: string): StoredImageItem => ({
  key,
  status: 'READY',
  width: 1200,
  height: 800,
  thumb: { url: swatch('#7aa6c2', 400, 267), width: 400, height: 267 },
  display: { url: swatch('#3d6f91', 1200, 800), width: 1200, height: 800 },
})

/**
 * 서버의 완료 호출(§5)을 흉내 낸다 — 파일 이름이 결과를 정한다:
 * `reject` 가 들어가면 400 `STORAGE.FILE_REJECTED`(`CONTENT_MISMATCH`), `pending` 이면 처리 중, 그 밖에는 `READY`.
 */
function fakeComplete(key: string) {
  if (key.includes('reject'))
    throw new ApiRequestError(
      {
        code: 'STORAGE.FILE_REJECTED',
        title: 'File rejected',
        status: 400,
        timestamp: '2026-11-02T00:00:00Z',
        data: { errors: [{ code: 'CONTENT_MISMATCH', message: 'content does not match' }] },
      },
      'trace',
      'span',
      '00-trace-span-01',
    )
  return {
    key,
    contentType: 'image/png',
    sizeBytes: TINY_PNG.length,
    image: key.includes('pending')
      ? { status: 'PENDING' as const }
      : { status: 'READY' as const, width: 1200, height: 800 },
  }
}

/** 업로드를 흉내 낸다 — presign 은 가짜 주소를, PUT 은 `steps` 번에 나눠 진행률을 보고한다(`stepMs` 간격, 취소 가능) */
export function createFakeStorage({ steps = 10, stepMs = 150 } = {}) {
  const api: StorageApi = {
    presignUpload: async ({ fileName }) => ({
      key: `demo/${fileName}`,
      method: 'PUT',
      url: `https://storage.invalid/demo/${encodeURIComponent(fileName)}`,
      headers: {},
    }),
    complete: async (key) => fakeComplete(key),
    images: async (keys) => keys.map(fakeStoredImage),
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
