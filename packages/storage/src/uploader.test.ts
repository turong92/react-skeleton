import { describe, expect, it, vi } from 'vitest'
import { UploadAbortedError, StorageValidationError } from './errors'
import type { CompletedPart, StorageApi } from './storageApi'
import { createUploader } from './uploader'
import type { PutRequest, UploadTransport } from './xhrTransport'

const file = (size: number, name = 'cat.png', type = 'image/png') =>
  new File([new Uint8Array(size)], name, { type })

function fakes(options: { multipart?: boolean; validate?: StorageApi['validate'] } = {}) {
  const calls: string[] = []
  const puts: Array<PutRequest & { size: number }> = []
  let inFlight = 0
  let maxInFlight = 0
  const api: StorageApi = {
    presignUpload: vi.fn(async (c) => {
      calls.push(`presign:${c.fileName}`)
      return {
        key: `uploads/${c.fileName}`,
        method: 'PUT',
        url: 'https://s3.test/single',
        headers: { 'x-amz-meta-a': '1' },
      }
    }),
    validate: options.validate,
    multipart: options.multipart
      ? {
          start: vi.fn(
            async () => (calls.push('start'), { key: 'uploads/big.bin', uploadId: 'up-1' }),
          ),
          presignPart: vi.fn(
            async (r) => (
              calls.push(`part:${r.partNumber}`),
              {
                key: r.key,
                uploadId: r.uploadId,
                partNumber: r.partNumber,
                method: 'PUT',
                url: `https://s3.test/part/${r.partNumber}`,
                headers: {},
              }
            ),
          ),
          complete: vi.fn(
            async (r: { key: string; uploadId: string; parts: CompletedPart[] }) => (
              calls.push(`complete:${r.parts.map((p) => `${p.partNumber}=${p.eTag}`).join(',')}`),
              { key: r.key, uploadId: r.uploadId }
            ),
          ),
          abort: vi.fn(async () => void calls.push('abort')),
        }
      : undefined,
  }
  const transport: UploadTransport & { failPart?: number } = {
    async put(request) {
      puts.push({ ...request, size: request.body.size })
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      try {
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 1))
        if (request.signal?.aborted) throw new UploadAbortedError()
        const part = /\/part\/(\d+)$/.exec(request.url)?.[1]
        if (part && Number(part) === transport.failPart) throw new Error('part failed')
        request.onProgress?.(request.body.size, request.body.size)
        return { status: 200, etag: part ? `"etag-${part}"` : '"single"' }
      } finally {
        inFlight -= 1
      }
    },
  }
  return { api, transport, calls, puts, maxInFlight: () => maxInFlight }
}

describe('createUploader — single presigned PUT', () => {
  it('presigns, PUTs the file with the presigned headers, and returns the key (+ public url)', async () => {
    const { api, transport, puts } = fakes()
    const uploader = createUploader({
      api,
      transport,
      publicUrl: (key) => `https://cdn.test/${key}`,
    })
    const result = await uploader.upload(file(100))
    expect(result).toEqual({
      key: 'uploads/cat.png',
      publicUrl: 'https://cdn.test/uploads/cat.png',
      etag: '"single"',
      multipart: false,
    })
    expect(api.presignUpload).toHaveBeenCalledWith({
      fileName: 'cat.png',
      contentType: 'image/png',
      sizeBytes: 100,
    })
    expect(puts).toHaveLength(1)
    expect(puts[0]).toMatchObject({
      url: 'https://s3.test/single',
      method: 'PUT',
      headers: { 'x-amz-meta-a': '1' },
      size: 100,
    })
  })

  it('without a public url resolver publicUrl is null; a file without a type is sent as application/octet-stream metadata', async () => {
    const { api, transport } = fakes()
    const result = await createUploader({ api, transport }).upload(file(1, 'blob', ''))
    expect(result.publicUrl).toBeNull()
    expect(api.presignUpload).toHaveBeenCalledWith({
      fileName: 'blob',
      contentType: 'application/octet-stream',
      sizeBytes: 1,
    })
  })

  it('reports progress as a fraction ending at 1', async () => {
    const { api, transport } = fakes()
    const seen: number[] = []
    await createUploader({ api, transport }).upload(file(100), {
      onProgress: (p) => seen.push(p.fraction),
    })
    expect(seen.at(-1)).toBe(1)
    expect(seen.every((n, i) => i === 0 || n >= seen[i - 1])).toBe(true)
  })

  it('client rules reject before any request is made', async () => {
    const { api, transport } = fakes()
    const uploader = createUploader({ api, transport, rules: { maxSizeBytes: 10 } })
    const failure = await uploader.upload(file(11)).catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(StorageValidationError)
    expect((failure as StorageValidationError).errors[0].code).toBe('SIZE_TOO_LARGE')
    expect(api.presignUpload).not.toHaveBeenCalled()
  })

  it('the server-side validate endpoint (when the api has one) can reject too, before presigning', async () => {
    const validate = vi.fn(async () => [{ code: 'UNSUPPORTED_EXTENSION', message: 'no' }])
    const { api, transport } = fakes({ validate })
    const failure = await createUploader({ api, transport })
      .upload(file(5))
      .catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(StorageValidationError)
    expect(validate).toHaveBeenCalledWith({
      fileName: 'cat.png',
      contentType: 'image/png',
      sizeBytes: 5,
    })
    expect(api.presignUpload).not.toHaveBeenCalled()
  })

  it('an already-aborted signal rejects with UploadAbortedError and calls nothing', async () => {
    const { api, transport } = fakes()
    const controller = new AbortController()
    controller.abort()
    await expect(
      createUploader({ api, transport }).upload(file(1), { signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadAbortedError)
    expect(api.presignUpload).not.toHaveBeenCalled()
  })
})

describe('createUploader — multipart', () => {
  const multipart = { thresholdBytes: 9, partSizeBytes: 4, concurrency: 2 }

  it('a file over the threshold is cut into parts, each presigned and PUT, then completed with the ETags in part order', async () => {
    const { api, transport, calls, puts } = fakes({ multipart: true })
    const result = await createUploader({ api, transport, multipart }).upload(
      file(10, 'big.bin', 'application/octet-stream'),
    )
    expect(result).toMatchObject({ key: 'uploads/big.bin', multipart: true })
    expect(puts.map((p) => p.size).sort()).toEqual([2, 4, 4])
    expect(calls.filter((c) => c.startsWith('part:')).sort()).toEqual([
      'part:1',
      'part:2',
      'part:3',
    ])
    expect(calls.at(-1)).toBe('complete:1="etag-1",2="etag-2",3="etag-3"')
    expect(api.multipart!.presignPart).toHaveBeenCalledWith(
      expect.objectContaining({ partNumber: 3, contentLength: 2 }),
    )
  })

  it('never has more parts in flight than the concurrency', async () => {
    const { api, transport, maxInFlight } = fakes({ multipart: true })
    await createUploader({ api, transport, multipart: { ...multipart, concurrency: 2 } }).upload(
      file(20),
    )
    expect(maxInFlight()).toBeLessThanOrEqual(2)
    expect(maxInFlight()).toBeGreaterThan(1)
  })

  it('progress adds up across parts and ends at 1', async () => {
    const { api, transport } = fakes({ multipart: true })
    const seen: number[] = []
    await createUploader({ api, transport, multipart }).upload(file(10), {
      onProgress: (p) => seen.push(p.fraction),
    })
    expect(seen.at(-1)).toBe(1)
    expect(Math.max(...seen)).toBeLessThanOrEqual(1)
  })

  it('a file at or under the threshold, or an api without multipart endpoints, uses the single PUT', async () => {
    const small = fakes({ multipart: true })
    expect(
      (
        await createUploader({ api: small.api, transport: small.transport, multipart }).upload(
          file(9),
        )
      ).multipart,
    ).toBe(false)
    const none = fakes()
    expect(
      (
        await createUploader({ api: none.api, transport: none.transport, multipart }).upload(
          file(50),
        )
      ).multipart,
    ).toBe(false)
  })

  it('a failing part aborts the multipart upload on the server and rethrows', async () => {
    const { api, transport, calls } = fakes({ multipart: true })
    transport.failPart = 2
    await expect(createUploader({ api, transport, multipart }).upload(file(10))).rejects.toThrow(
      'part failed',
    )
    expect(calls).toContain('abort')
    expect(calls.some((c) => c.startsWith('complete'))).toBe(false)
  })

  it('aborting the signal mid-upload aborts the server-side upload and rejects with UploadAbortedError', async () => {
    const { api, transport, calls } = fakes({ multipart: true })
    const controller = new AbortController()
    const promise = createUploader({ api, transport, multipart }).upload(file(10), {
      signal: controller.signal,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort()
    await expect(promise).rejects.toBeInstanceOf(UploadAbortedError)
    expect(calls).toContain('abort')
  })

  it('a part answer without an ETag is an error that names the CORS cause (ExposeHeaders)', async () => {
    const { api, transport } = fakes({ multipart: true })
    const original = transport.put.bind(transport)
    transport.put = async (request) => ({ ...(await original(request)), etag: null })
    await expect(createUploader({ api, transport, multipart }).upload(file(10))).rejects.toThrow(
      /ETag.*ExposeHeaders|ExposeHeaders.*ETag/,
    )
  })

  it('grows the part size when the file would need more parts than the limit (backend: 1..10000)', async () => {
    const { api, transport } = fakes({ multipart: true })
    await createUploader({
      api,
      transport,
      multipart: { thresholdBytes: 1, partSizeBytes: 1, concurrency: 4, maxParts: 5 },
    }).upload(file(20))
    const parts = (api.multipart!.presignPart as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0].partNumber,
    )
    expect(Math.max(...parts)).toBe(5)
    expect(
      (api.multipart!.presignPart as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => c[0].contentLength,
      ),
    ).toEqual(expect.arrayContaining([4]))
  })
})
