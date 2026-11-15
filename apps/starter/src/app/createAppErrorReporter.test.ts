import { describe, expect, it } from 'vitest'
import { createAppErrorReporter } from './createAppErrorReporter'

const client = {
  endpoint: (path: string) => `/api/v1${path}`,
  lastTraceId: () => '0af7651916cd43dd8448eb211c80319c',
}

describe('createAppErrorReporter — the env wiring a project copies', () => {
  it('reports nowhere unless VITE_ERROR_REPORT is "true" (the backend path is off by default too)', () => {
    const sent: unknown[] = []
    const reporter = createAppErrorReporter({
      env: {},
      client,
      send: (...args) => {
        sent.push(args)
      },
    })
    reporter.report(new Error('boom'))
    expect(sent).toEqual([])
  })

  it('when on, posts to the backend client-errors path with the release and the last request trace id', () => {
    const sent: Array<[string, Record<string, unknown>]> = []
    const reporter = createAppErrorReporter({
      env: { VITE_ERROR_REPORT: 'true', VITE_APP_RELEASE: '2.3.4' },
      client,
      send: (url, payload) => {
        sent.push([url, { ...payload }])
      },
    })

    reporter.report(new Error('boom'))

    expect(sent).toHaveLength(1)
    expect(sent[0][0]).toBe('/api/v1/client-errors')
    expect(sent[0][1]).toMatchObject({
      message: 'boom',
      release: '2.3.4',
      traceId: '0af7651916cd43dd8448eb211c80319c',
    })
  })
})
