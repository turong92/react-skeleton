import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import type { PartPut } from './putPart'
import type { CompletedPart, PartTarget, UploadedPart } from './types'
import {
  contentTypeOf,
  UnsupportedVideoFileError,
  uploadVideo,
  UploadPartError,
} from './uploadVideo'
import type { VideoApi } from './videoApi'

const MB = 1024 * 1024

const file = (bytes: number, name = 'a.mp4', type = 'video/mp4', lastModified = 1) =>
  new File([new Uint8Array(bytes)], name, { type, lastModified })

const target = (number: number): PartTarget => ({
  number,
  method: 'PUT',
  url: `https://store/part${number}`,
  headers: {},
})

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

/** 호출 순서를 기록하는 가짜 서버 + 저장소 */
function fakes(overrides: { listParts?: VideoApi['listParts'] } = {}) {
  const calls: string[] = []
  const api = {
    start: vi.fn(async (input: { bytes: number }) => {
      calls.push(`start ${input.bytes}`)
      return { id: 'v1', uploadId: 'u1', partSize: 5 * MB }
    }),
    presignParts: vi.fn(async (_id: string, numbers: number[]) => {
      calls.push(`presign ${numbers.join(',')}`)
      return numbers.map(target)
    }),
    listParts: vi.fn(
      overrides.listParts ??
        (async () => {
          calls.push('listParts')
          return [] as UploadedPart[]
        }),
    ),
    complete: vi.fn(async (_id: string, parts: CompletedPart[]) => {
      calls.push(`complete ${parts.map((p) => `${p.n}:${p.etag}`).join(',')}`)
      return { id: 'v1', status: 'QUEUED' } as never
    }),
  }
  const put = vi.fn(async (t: PartTarget, blob: Blob) => {
    calls.push(`put ${t.number} ${blob.size}`)
    return `"e${t.number}"`
  })
  return { calls, api, put, sleep: () => Promise.resolve() }
}

const base = { purpose: 'clip', visibility: 'PRIVATE' } as const

describe('uploadVideo', () => {
  it('cuts the file by the server part size and completes with etags in part order', async () => {
    const f = fakes()
    const progress: number[] = []
    await uploadVideo(f.api, file(12 * MB), {
      ...base,
      onProgress: (sent) => progress.push(sent),
      put: f.put,
      sleep: f.sleep,
    })
    expect(f.calls[0]).toBe('start 12582912')
    expect(f.calls).toContain(`put 1 ${5 * MB}`)
    expect(f.calls).toContain(`put 3 ${2 * MB}`)
    expect(f.calls.at(-1)).toBe('complete 1:"e1",2:"e2",3:"e3"')
    expect(f.api.start).toHaveBeenCalledWith({
      bytes: 12 * MB,
      contentType: 'video/mp4',
      purpose: 'clip',
      visibility: 'PRIVATE',
    })
    expect(progress.at(-1)).toBe(12 * MB)
  })

  it('never reports progress going backwards', async () => {
    const f = fakes()
    const put = vi.fn(async (t: PartTarget, blob: Blob, o: { onProgress: (n: number) => void }) => {
      o.onProgress(blob.size / 2)
      o.onProgress(blob.size)
      return `"e${t.number}"`
    })
    const seen: number[] = []
    await uploadVideo(f.api, file(12 * MB), {
      ...base,
      onProgress: (s) => seen.push(s),
      put,
      sleep: f.sleep,
    })
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
  })

  it('resends only the failed part, with a fresh signed URL', async () => {
    const f = fakes()
    let failures = 0
    const put = vi.fn(async (t: PartTarget) => {
      if (t.number === 2 && failures < 2) {
        failures += 1
        throw new UploadPartError(2)
      }
      return `"e${t.number}"`
    })
    await uploadVideo(f.api, file(12 * MB), { ...base, put, sleep: f.sleep })
    expect(f.calls.filter((c) => c === 'presign 2')).toHaveLength(2)
    expect(put.mock.calls.filter(([t]) => t.number === 1)).toHaveLength(1)
  })

  it('stops with UploadPartError after four tries on one part and does not complete', async () => {
    const f = fakes()
    const put = vi.fn<PartPut>(async () => {
      throw new UploadPartError(1)
    })
    await expect(
      uploadVideo(f.api, file(12 * MB), { ...base, put, sleep: f.sleep }),
    ).rejects.toBeInstanceOf(UploadPartError)
    expect(f.api.complete).not.toHaveBeenCalled()
    expect(put.mock.calls.filter(([t]) => t.number === 1)).toHaveLength(4)
  })

  it('aborts without completing', async () => {
    const f = fakes()
    const controller = new AbortController()
    const put = vi.fn(async (t: PartTarget) => {
      controller.abort()
      return `"e${t.number}"`
    })
    await expect(
      uploadVideo(f.api, file(12 * MB), {
        ...base,
        put,
        sleep: f.sleep,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(f.api.complete).not.toHaveBeenCalled()
  })

  it('rejects a file that is not mp4 or mov before calling the server', async () => {
    const f = fakes()
    await expect(
      uploadVideo(f.api, file(MB, 'a.webm', 'video/webm'), { ...base, put: f.put, sleep: f.sleep }),
    ).rejects.toBeInstanceOf(UnsupportedVideoFileError)
    expect(f.api.start).not.toHaveBeenCalled()
  })

  it('guesses the content type from the extension when the browser leaves it empty', () => {
    expect(contentTypeOf(file(1, 'a.MOV', ''))).toBe('video/quicktime')
    expect(contentTypeOf(file(1, 'a.mp4', ''))).toBe('video/mp4')
    expect(contentTypeOf(file(1, 'a.mov', 'video/quicktime'))).toBe('video/quicktime')
    expect(contentTypeOf(file(1, 'a.png', 'image/png'))).toBeNull()
  })
})

describe('uploadVideo resume', () => {
  it('remembers the upload and, on picking the same file again, sends only the missing parts', async () => {
    const storage = memoryStorage()
    const first = fakes()
    const failing = vi.fn(async (t: PartTarget) => {
      if (t.number === 3) throw new DOMException('aborted', 'AbortError')
      return `"e${t.number}"`
    })
    await expect(
      uploadVideo(first.api, file(12 * MB), {
        ...base,
        resume: true,
        storage,
        put: failing,
        sleep: first.sleep,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(storage.map.size).toBe(1)

    const second = fakes({
      listParts: async () => [
        { n: 1, etag: '"e1"', bytes: 5 * MB },
        { n: 2, etag: '"e2"', bytes: 5 * MB },
      ],
    })
    await uploadVideo(second.api, file(12 * MB), {
      ...base,
      resume: true,
      storage,
      put: second.put,
      sleep: second.sleep,
    })
    expect(second.api.start).not.toHaveBeenCalled()
    expect(second.calls.filter((c) => c.startsWith('put'))).toEqual([`put 3 ${2 * MB}`])
    expect(second.calls.at(-1)).toBe('complete 1:"e1",2:"e2",3:"e3"')
    expect(storage.map.size).toBe(0)
  })

  it('starts over when the server no longer knows the upload (404)', async () => {
    const storage = memoryStorage()
    const seed = fakes()
    await uploadVideo(seed.api, file(12 * MB), {
      ...base,
      resume: true,
      storage,
      put: vi.fn(async () => {
        throw new DOMException('aborted', 'AbortError')
      }),
      sleep: seed.sleep,
    }).catch(() => {})
    const gone = new ApiRequestError(
      { code: 'VIDEO.NOT_FOUND', title: 'gone', status: 404, timestamp: 'z' },
      't',
      's',
      'p',
    )
    const f = fakes({
      listParts: async () => {
        throw gone
      },
    })
    await uploadVideo(f.api, file(12 * MB), {
      ...base,
      resume: true,
      storage,
      put: f.put,
      sleep: f.sleep,
    })
    expect(f.api.start).toHaveBeenCalledTimes(1)
    expect(f.calls.filter((c) => c.startsWith('put'))).toHaveLength(3)
  })

  it('starts from the beginning when the saved record has no uploadId', async () => {
    const storage = memoryStorage()
    const f = fakes()
    // 같은 파일 지문으로 uploadId 없는 낡은 기록을 둔다
    await uploadVideo(f.api, file(MB), {
      ...base,
      resume: true,
      storage,
      put: vi.fn(async () => {
        throw new DOMException('aborted', 'AbortError')
      }),
      sleep: f.sleep,
    }).catch(() => {})
    const [key] = [...storage.map.keys()]
    storage.map.set(key, JSON.stringify({ id: 'v1' }))
    const g = fakes()
    await uploadVideo(g.api, file(MB), {
      ...base,
      resume: true,
      storage,
      put: g.put,
      sleep: g.sleep,
    })
    expect(g.api.start).toHaveBeenCalledTimes(1)
    expect(g.api.listParts).not.toHaveBeenCalled()
  })

  it('resends a listed part whose size does not match', async () => {
    const storage = memoryStorage()
    const seed = fakes()
    await uploadVideo(seed.api, file(12 * MB), {
      ...base,
      resume: true,
      storage,
      put: vi.fn(async () => {
        throw new DOMException('aborted', 'AbortError')
      }),
      sleep: seed.sleep,
    }).catch(() => {})
    const f = fakes({
      listParts: async () => [{ n: 1, etag: '"stale"', bytes: 123 }],
    })
    await uploadVideo(f.api, file(12 * MB), {
      ...base,
      resume: true,
      storage,
      put: f.put,
      sleep: f.sleep,
    })
    expect(f.calls.filter((c) => c.startsWith('put'))).toHaveLength(3)
    expect(f.calls.at(-1)).toBe('complete 1:"e1",2:"e2",3:"e3"')
  })

  it('does not touch storage unless resume is on', async () => {
    const storage = memoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    const f = fakes()
    await uploadVideo(f.api, file(MB), { ...base, storage, put: f.put, sleep: f.sleep })
    expect(setItem).not.toHaveBeenCalled()
    expect(f.api.listParts).not.toHaveBeenCalled()
  })
})
