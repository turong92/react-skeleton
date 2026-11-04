import { ApiRequestError } from '@skeleton/api-client'
import { putPartXhr, UploadPartError, type PartPut } from './putPart'
import type { CompletedPart, PartTarget, VideoItem, VideoVisibility } from './types'
import type { VideoApi } from './videoApi'

export { UploadPartError }

/** 형식이 MP4 · MOV 가 아니라 서버에 보내지 않고 막은 파일 */
export class UnsupportedVideoFileError extends Error {
  constructor() {
    super('unsupported video file')
    this.name = 'UnsupportedVideoFileError'
  }
}

/** 서버가 받는 형식(MP4 · MOV)으로 - 브라우저가 형식을 비워 두면 확장자로 짐작한다. 아니면 null */
export function contentTypeOf(file: File): 'video/mp4' | 'video/quicktime' | null {
  const type = file.type.trim().toLowerCase()
  if (type === 'video/mp4') return 'video/mp4'
  if (type === 'video/quicktime') return 'video/quicktime'
  if (type !== '') return null
  const name = file.name.toLowerCase()
  if (name.endsWith('.mp4')) return 'video/mp4'
  if (name.endsWith('.mov')) return 'video/quicktime'
  return null
}

/** 이어 올리기 기록을 두는 곳(기본 `localStorage`) */
export type ResumeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type UploadVideoOptions = {
  purpose: string
  visibility: VideoVisibility
  /** 지금까지 보낸 바이트 합(줄지 않는다) */
  onProgress?: (sent: number) => void
  signal?: AbortSignal
  /** 올리기가 열린 직후(이어 올리기면 이어 받은 직후) - 취소하면 서버에서 지울 영상 번호 */
  onStarted?: (id: string) => void
  /**
   * 이어 올리기 - `{영상 번호, uploadId, 조각 크기}` 를 파일 지문(목적 · 공개 여부 · 이름 · 크기 · 수정 시각)으로 `localStorage` 에 두고,
   * 같은 파일을 다시 고르면 `GET parts` 로 이미 올라간 조각을 알아내 빠진 조각만 보낸다. 끝나면 기록을 비운다
   */
  resume?: boolean
  /** 시험 · 스토리용 - 조각 `PUT` (기본은 XHR) */
  put?: PartPut
  sleep?: (ms: number) => Promise<void>
  storage?: ResumeStorage
}

/** 조각마다 이만큼 시도한다 - 처음 + 세 번 다시 */
const ATTEMPTS = 4
/** 한꺼번에 올리는 조각 수 */
const CONCURRENCY = 3
/** 서버 `parts` 호출 한 번의 번호 수 상한 */
const PARTS_PER_CALL = 100
const RETRY_BASE_MS = 500

type ResumeRecord = { id: string; uploadId: string; partSize: number }

const aborted = () => new DOMException('aborted', 'AbortError')
const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

function defaultStorage(): ResumeStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** 저장소를 못 쓰거나(사생활 보호 창 · 가득 참) 기록이 깨졌으면 없는 것으로 친다 */
function readRecord(storage: ResumeStorage | undefined, key: string): ResumeRecord | null {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<ResumeRecord>
    return typeof value.id === 'string' &&
      typeof value.uploadId === 'string' &&
      typeof value.partSize === 'number'
      ? (value as ResumeRecord)
      : null
  } catch {
    return null
  }
}

function writeRecord(storage: ResumeStorage | undefined, key: string, record: ResumeRecord | null) {
  try {
    if (record) storage?.setItem(key, JSON.stringify(record))
    else storage?.removeItem(key)
  } catch {
    // 이어 올리기만 못 할 뿐 올리기는 계속된다
  }
}

/** 공개 여부도 지문에 든다 - 비공개로 시작한 올리기가 공개 영상으로 이어지지 않게 */
const fingerprint = (file: File, purpose: string, visibility: VideoVisibility) =>
  `skeleton.video.upload:${purpose}:${visibility}:${file.name}:${file.size}:${file.lastModified}`

/**
 * 영상 한 편을 멀티파트로 직접 올린다. 시작 → 조각을 잘라 3개씩 병렬 `PUT`(조각마다 4번까지, 다시 보낼 땐 새 서명 주소) → 마치기.
 * 마치기는 조각 번호순 `ETag` 목록. 끝내 안 되는 조각은 [UploadPartError], 취소하면 `AbortError`, 서버 거절은 `ApiRequestError` 그대로
 */
export async function uploadVideo(
  api: Pick<VideoApi, 'start' | 'presignParts' | 'listParts' | 'complete'>,
  file: File,
  options: UploadVideoOptions,
): Promise<VideoItem> {
  const {
    signal,
    onProgress,
    put = putPartXhr,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = options
  const contentType = contentTypeOf(file)
  if (!contentType) throw new UnsupportedVideoFileError()
  if (signal?.aborted) throw aborted()

  const storage = options.resume ? (options.storage ?? defaultStorage()) : undefined
  const key = fingerprint(file, options.purpose, options.visibility)
  const total = file.size
  const sizeOf = (partSize: number, n: number) => Math.min(partSize, total - (n - 1) * partSize)

  let session: ResumeRecord | null = options.resume ? readRecord(storage, key) : null
  const done = new Map<number, string>()
  if (session) {
    try {
      for (const part of await api.listParts(session.id))
        if (part.bytes === sizeOf(session.partSize, part.n)) done.set(part.n, part.etag)
    } catch (error) {
      // 서버가 모르는 올리기(치워졌다)면 처음부터. 그 밖의 오류(네트워크 …)는 그대로 알린다
      if (!(error instanceof ApiRequestError && error.apiError.status === 404)) throw error
      writeRecord(storage, key, null)
      session = null
    }
  }
  if (!session) {
    const started = await api.start({
      bytes: total,
      contentType,
      purpose: options.purpose,
      visibility: options.visibility,
    })
    session = { id: started.id, uploadId: started.uploadId, partSize: started.partSize }
    writeRecord(storage, key, options.resume ? session : null)
  }
  const { id, partSize } = session
  options.onStarted?.(id)

  const partCount = Math.ceil(total / partSize)
  const numbers = Array.from({ length: partCount }, (_, i) => i + 1)
  const sentByPart = new Map<number, number>()
  for (const n of done.keys()) sentByPart.set(n, sizeOf(partSize, n))
  let reported = 0
  const report = () => {
    let sum = 0
    for (const sent of sentByPart.values()) sum += sent
    reported = Math.max(reported, Math.min(sum, total))
    onProgress?.(reported)
  }
  if (done.size > 0) report()

  const urls = new Map<number, PartTarget>()
  const missing = numbers.filter((n) => !done.has(n))
  for (let at = 0; at < missing.length; at += PARTS_PER_CALL)
    for (const target of await api.presignParts(id, missing.slice(at, at + PARTS_PER_CALL)))
      urls.set(target.number, target)

  async function sendPart(number: number): Promise<void> {
    const start = (number - 1) * partSize
    const part = file.slice(start, start + sizeOf(partSize, number))
    let target = urls.get(number)!
    for (let attempt = 1; ; attempt += 1) {
      if (signal?.aborted) throw aborted()
      try {
        const etag = await put(target, part, {
          signal,
          onProgress: (sent) => {
            sentByPart.set(number, Math.min(sent, part.size))
            report()
          },
        })
        sentByPart.set(number, part.size)
        report()
        done.set(number, etag)
        return
      } catch (error) {
        if (signal?.aborted || isAbort(error)) throw aborted()
        if (attempt >= ATTEMPTS) throw error
        sentByPart.set(number, 0)
        await sleep(RETRY_BASE_MS * 2 ** (attempt - 1))
        // 서명 주소가 만료됐을 수 있다 - 이 조각만 새로 받는다
        const [fresh] = await api.presignParts(id, [number])
        target = fresh ?? target
      }
    }
  }

  const queue = [...missing]
  let failure: unknown = null
  async function worker() {
    while (failure === null) {
      const next = queue.shift()
      if (next === undefined) return
      try {
        await sendPart(next)
      } catch (error) {
        failure = error
        return
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker))
  if (failure !== null) throw failure
  if (signal?.aborted) throw aborted()

  const parts: CompletedPart[] = numbers.map((n) => ({ n, etag: done.get(n)! }))
  const completed = await api.complete(id, parts)
  writeRecord(storage, key, null)
  return completed
}
