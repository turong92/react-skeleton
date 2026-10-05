import { describe, expect, it } from 'vitest'
import { createUploadController } from './controller'
import { UploadAbortedError } from './errors'
import type { Uploader, UploadResult } from './uploader'

function deferredUploader() {
  let resolve!: (value: UploadResult) => void
  let reject!: (reason: unknown) => void
  let progress: ((p: { loaded: number; total: number; fraction: number }) => void) | undefined
  let signal: AbortSignal | undefined
  const uploader: Uploader = {
    upload: (_file, options) => {
      progress = options?.onProgress
      signal = options?.signal
      signal?.addEventListener('abort', () => reject(new UploadAbortedError()))
      return new Promise<UploadResult>((res, rej) => {
        resolve = res
        reject = rej
      })
    },
  }
  return {
    uploader,
    resolve: (v: UploadResult) => resolve(v),
    reject: (e: unknown) => reject(e),
    emit: (p: { loaded: number; total: number; fraction: number }) => progress?.(p),
    signal: () => signal,
  }
}
const file = new File(['abc'], 'a.png', { type: 'image/png' })
const result: UploadResult = { key: 'k', publicUrl: null, etag: null, multipart: false }

describe('createUploadController (the state behind useUpload)', () => {
  it('starts idle with no progress', () => {
    const { uploader } = deferredUploader()
    expect(createUploadController(uploader).getState()).toEqual({
      status: 'idle',
      progress: 0,
      loaded: 0,
      total: 0,
      result: null,
      error: null,
    })
  })

  it('upload → uploading with progress → done with the result', async () => {
    const d = deferredUploader()
    const controller = createUploadController(d.uploader)
    const states: string[] = []
    controller.subscribe(() => states.push(controller.getState().status))
    const promise = controller.upload(file)
    expect(controller.getState().status).toBe('uploading')
    d.emit({ loaded: 1, total: 3, fraction: 1 / 3 })
    expect(controller.getState()).toMatchObject({
      status: 'uploading',
      progress: 1 / 3,
      loaded: 1,
      total: 3,
    })
    d.resolve(result)
    await expect(promise).resolves.toEqual(result)
    expect(controller.getState()).toMatchObject({ status: 'done', progress: 1, result })
    expect(states).toContain('done')
  })

  it('a failure ends in error state with the error, and upload() rethrows', async () => {
    const d = deferredUploader()
    const controller = createUploadController(d.uploader)
    const promise = controller.upload(file)
    const boom = new Error('boom')
    d.reject(boom)
    await expect(promise).rejects.toBe(boom)
    expect(controller.getState()).toMatchObject({ status: 'error', error: boom })
  })

  it('abort cancels the signal and ends in aborted state — upload() resolves to null instead of throwing', async () => {
    const d = deferredUploader()
    const controller = createUploadController(d.uploader)
    const promise = controller.upload(file)
    controller.abort()
    expect(d.signal()?.aborted).toBe(true)
    await expect(promise).resolves.toBeNull()
    expect(controller.getState().status).toBe('aborted')
  })

  it('reset goes back to idle; starting a new upload aborts the one still running', async () => {
    const d = deferredUploader()
    const controller = createUploadController(d.uploader)
    void controller.upload(file).catch(() => {})
    const first = d.signal()
    void controller.upload(file).catch(() => {})
    expect(first?.aborted).toBe(true)
    controller.reset()
    expect(controller.getState().status).toBe('idle')
  })

  it('getState returns the same object until something changes (useSyncExternalStore needs that)', () => {
    const { uploader } = deferredUploader()
    const controller = createUploadController(uploader)
    expect(controller.getState()).toBe(controller.getState())
  })
})
