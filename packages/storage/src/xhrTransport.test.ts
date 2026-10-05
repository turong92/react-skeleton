import { describe, expect, it } from 'vitest'
import { createXhrTransport } from './xhrTransport'
import { UploadAbortedError, UploadHttpError } from './errors'

class FakeXhr {
  static last: FakeXhr
  method = ''
  url = ''
  headers: Record<string, string> = {}
  sent: unknown = undefined
  aborted = false
  status = 0
  responseHeaders: Record<string, string> = {}
  upload = {
    onprogress: null as
      | null
      | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void),
  }
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  onabort: null | (() => void) = null
  constructor() {
    FakeXhr.last = this
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
  getResponseHeader(name: string) {
    return this.responseHeaders[name.toLowerCase()] ?? null
  }
  send(body: unknown) {
    this.sent = body
  }
  abort() {
    this.aborted = true
    this.onabort?.()
  }
}
const transport = () => createXhrTransport(FakeXhr as unknown as typeof XMLHttpRequest)
const body = new Blob(['hello'])

describe('createXhrTransport (XMLHttpRequest because fetch has no upload progress)', () => {
  it('PUTs the body to the presigned url with the presigned headers and resolves with status + ETag', async () => {
    const promise = transport().put({
      url: 'https://s3.test/x?sig=1',
      method: 'PUT',
      headers: { 'x-amz-meta-a': '1', 'Content-Type': 'image/png' },
      body,
    })
    const xhr = FakeXhr.last
    expect(xhr.method).toBe('PUT')
    expect(xhr.url).toBe('https://s3.test/x?sig=1')
    expect(xhr.headers).toEqual({ 'x-amz-meta-a': '1', 'Content-Type': 'image/png' })
    expect(xhr.sent).toBe(body)
    xhr.status = 200
    xhr.responseHeaders.etag = '"abc"'
    xhr.onload!()
    await expect(promise).resolves.toEqual({ status: 200, etag: '"abc"' })
  })

  it('never sets headers the browser forbids (Content-Length, Host)', async () => {
    const promise = transport().put({
      url: 'u',
      method: 'PUT',
      headers: { 'content-length': '5', Host: 's3.test', 'x-ok': '1' },
      body,
    })
    expect(FakeXhr.last.headers).toEqual({ 'x-ok': '1' })
    FakeXhr.last.status = 200
    FakeXhr.last.onload!()
    await promise
  })

  it('reports progress as loaded/total while the body goes out', async () => {
    const seen: Array<[number, number]> = []
    const promise = transport().put({
      url: 'u',
      method: 'PUT',
      headers: {},
      body,
      onProgress: (loaded, total) => seen.push([loaded, total]),
    })
    const xhr = FakeXhr.last
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 2, total: 5 })
    xhr.upload.onprogress!({ lengthComputable: false, loaded: 3, total: 0 })
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 5, total: 5 })
    xhr.status = 200
    xhr.onload!()
    await promise
    expect(seen).toEqual([
      [2, 5],
      [5, 5],
    ])
  })

  it('a non-2xx answer rejects with UploadHttpError carrying the status', async () => {
    const promise = transport().put({ url: 'u', method: 'PUT', headers: {}, body })
    FakeXhr.last.status = 403
    FakeXhr.last.onload!()
    const failure = await promise.catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(UploadHttpError)
    expect((failure as UploadHttpError).status).toBe(403)
  })

  it('a network failure rejects with a plain Error', async () => {
    const promise = transport().put({ url: 'u', method: 'PUT', headers: {}, body })
    FakeXhr.last.onerror!()
    await expect(promise).rejects.toThrow(/network/i)
  })

  it('aborting the signal aborts the request and rejects with UploadAbortedError', async () => {
    const controller = new AbortController()
    const promise = transport().put({
      url: 'u',
      method: 'PUT',
      headers: {},
      body,
      signal: controller.signal,
    })
    controller.abort()
    expect(FakeXhr.last.aborted).toBe(true)
    await expect(promise).rejects.toBeInstanceOf(UploadAbortedError)
  })

  it('an already-aborted signal never opens a request', async () => {
    const controller = new AbortController()
    controller.abort()
    FakeXhr.last = undefined as unknown as FakeXhr
    await expect(
      transport().put({ url: 'u', method: 'PUT', headers: {}, body, signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadAbortedError)
    expect(FakeXhr.last).toBeUndefined()
  })
})
