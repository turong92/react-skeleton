import { UploadAbortedError } from './errors'
import type { Uploader, UploadResult } from './uploader'

export type UploadState = {
  status: 'idle' | 'uploading' | 'done' | 'error' | 'aborted'
  /** 0..1 */
  progress: number
  loaded: number
  total: number
  result: UploadResult | null
  error: unknown
}

const IDLE: UploadState = {
  status: 'idle',
  progress: 0,
  loaded: 0,
  total: 0,
  result: null,
  error: null,
}

export type UploadController = {
  /** 바뀌기 전까지 같은 객체(`useSyncExternalStore` 용) */
  getState(): UploadState
  subscribe(listener: () => void): () => void
  /** 올린다. 성공하면 결과, 취소되면 `null`, 실패하면 던진다(상태도 `error`). 진행 중인 것이 있으면 먼저 취소한다 */
  upload(file: File): Promise<UploadResult | null>
  abort(): void
  reset(): void
}

/** `Uploader` 위의 작은 상태 기계 — React 없이 테스트된다(`useUpload` 는 이것을 구독할 뿐) */
export function createUploadController(uploader: Uploader): UploadController {
  const listeners = new Set<() => void>()
  let state = IDLE
  let current: AbortController | null = null

  const set = (next: UploadState) => {
    state = next
    listeners.forEach((listener) => listener())
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async upload(file) {
      current?.abort()
      const mine = new AbortController()
      current = mine
      set({ ...IDLE, status: 'uploading' })
      try {
        const result = await uploader.upload(file, {
          signal: mine.signal,
          onProgress: ({ loaded, total, fraction }) => {
            if (current === mine)
              set({ ...state, status: 'uploading', progress: fraction, loaded, total })
          },
        })
        if (current === mine) set({ ...state, status: 'done', progress: 1, result, error: null })
        return result
      } catch (error) {
        if (error instanceof UploadAbortedError || mine.signal.aborted) {
          if (current === mine) set({ ...IDLE, status: 'aborted' })
          return null
        }
        if (current === mine) set({ ...state, status: 'error', error })
        throw error
      }
    },
    abort() {
      current?.abort()
    },
    reset() {
      current?.abort()
      current = null
      set(IDLE)
    },
  }
}
