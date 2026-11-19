import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createErrorReporter,
  installGlobalErrorReporting,
  noopErrorReporter,
  type ErrorReportPayload,
} from './errorReport'

const TRACE = '0af7651916cd43dd8448eb211c80319c'

function setup(options: Partial<Parameters<typeof createErrorReporter>[0]> = {}) {
  const sent: Array<{ url: string; payload: ErrorReportPayload }> = []
  let clock = 1_000_000
  const reporter = createErrorReporter({
    endpoint: 'https://api.example.com/api/v1/client-errors',
    release: '1.4.2',
    getTraceId: () => TRACE,
    getRoute: () => '/orders/42',
    send: (url, payload) => {
      sent.push({ url, payload })
    },
    now: () => clock,
    ...options,
  })
  return {
    reporter,
    sent,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('createErrorReporter', () => {
  it('sends what the owner needs: error, route, release and the last request trace id', () => {
    const { reporter, sent } = setup()
    const error = new TypeError('x is undefined')

    reporter.report(error, { source: 'boundary', componentStack: '\n    at Orders' })

    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe('https://api.example.com/api/v1/client-errors')
    expect(sent[0].payload).toMatchObject({
      platform: 'web',
      source: 'boundary',
      name: 'TypeError',
      message: 'x is undefined',
      componentStack: '\n    at Orders',
      route: '/orders/42',
      release: '1.4.2',
      traceId: TRACE,
      count: 1,
    })
    expect(sent[0].payload.stack).toContain('TypeError: x is undefined')
  })

  it('reports things that are not Error objects too', () => {
    const { reporter, sent } = setup()
    reporter.report('plain text')
    reporter.report({ code: 7 })
    reporter.report(undefined)

    expect(sent.map((s) => s.payload.message)).toEqual(['plain text', '{"code":7}', 'undefined'])
    expect(sent.every((s) => s.payload.name === undefined)).toBe(true)
  })

  it('never sends an empty message (the server would answer 400 and still count it)', () => {
    const { reporter, sent } = setup()
    reporter.report(new TypeError(''))
    reporter.report('')
    expect(sent.map((s) => s.payload.message)).toEqual(['TypeError', 'Error'])
  })

  it('sends the first of a repeated error at once and folds the repeats into the next report', () => {
    const { reporter, sent, advance } = setup({ dedupeWindowMs: 60_000 })
    const boom = () => new Error('boom')

    reporter.report(boom())
    reporter.report(boom())
    reporter.report(boom())
    expect(sent).toHaveLength(1)

    advance(61_000)
    reporter.report(boom())
    expect(sent).toHaveLength(2)
    expect(sent[1].payload.count).toBe(3)
  })

  it('flush sends the folded repeats that no later report would have carried', () => {
    const { reporter, sent } = setup()
    const boom = () => new Error('boom')
    reporter.report(boom())
    reporter.report(boom())
    reporter.report(boom())

    reporter.flush?.()
    expect(sent).toHaveLength(2)
    expect(sent[1].payload).toMatchObject({ message: 'boom', count: 2 })

    reporter.flush?.()
    expect(sent).toHaveLength(2)
  })

  it('does not fold different errors into each other', () => {
    const { reporter, sent } = setup()
    reporter.report(new Error('one'))
    reporter.report(new Error('two'))
    expect(sent.map((s) => s.payload.message)).toEqual(['one', 'two'])
  })

  it('stops after a budget of reports per page load, so a render loop cannot flood the server', () => {
    const { reporter, sent } = setup({ maxReports: 3 })
    for (let i = 0; i < 10; i += 1) reporter.report(new Error(`distinct ${i}`))
    expect(sent).toHaveLength(3)
  })

  it('never throws into the app: a failing transport, a failing route or trace lookup', async () => {
    const sendFails = setup({
      send: () => {
        throw new Error('network down')
      },
    })
    expect(() => sendFails.reporter.report(new Error('a'))).not.toThrow()

    const rejects = setup({ send: () => Promise.reject(new Error('offline')) })
    expect(() => rejects.reporter.report(new Error('b'))).not.toThrow()
    await Promise.resolve()

    const lookupFails = setup({
      getRoute: () => {
        throw new Error('no location')
      },
      getTraceId: () => {
        throw new Error('no client')
      },
    })
    lookupFails.reporter.report(new Error('c'))
    expect(lookupFails.sent).toHaveLength(1)
    expect(lookupFails.sent[0].payload.route).toBeUndefined()
    expect(lookupFails.sent[0].payload.traceId).toBeUndefined()
  })

  it('cuts oversized fields before they leave the device', () => {
    const { reporter, sent } = setup()
    const error = new Error('m'.repeat(5_000))
    error.stack = 's'.repeat(20_000)
    reporter.report(error, { componentStack: 'c'.repeat(20_000) })

    expect(sent[0].payload.message).toHaveLength(500)
    expect(sent[0].payload.stack).toHaveLength(4_000)
    expect(sent[0].payload.componentStack).toHaveLength(1_500)
  })

  it('by default posts JSON with keepalive and without credentials, and ignores a refusal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)
    const reporter = createErrorReporter({
      endpoint: '/api/v1/client-errors',
      release: '1.0.0',
      getRoute: () => '/x',
    })

    reporter.report(new Error('boom'))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/client-errors')
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' })
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
    expect(JSON.parse(init.body as string)).toMatchObject({ message: 'boom', release: '1.0.0' })
  })

  it('has a reporter that does nothing, for apps and tests that report nowhere', () => {
    expect(() => noopErrorReporter.report(new Error('x'))).not.toThrow()
  })
})

describe('installGlobalErrorReporting', () => {
  function fakeWindow() {
    return new EventTarget()
  }

  it('reports uncaught errors and unhandled rejections, and stops after uninstall', () => {
    const { reporter, sent } = setup()
    const target = fakeWindow()
    const uninstall = installGlobalErrorReporting(reporter, target)

    target.dispatchEvent(Object.assign(new Event('error'), { error: new RangeError('bad index') }))
    target.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: new Error('rejected') }),
    )
    expect(sent.map((s) => [s.payload.source, s.payload.message])).toEqual([
      ['window.onerror', 'bad index'],
      ['unhandledrejection', 'rejected'],
    ])

    uninstall()
    target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('later') }))
    expect(sent).toHaveLength(2)
  })

  it('reports a script error that carries only a message (cross-origin script)', () => {
    const { reporter, sent } = setup()
    const target = fakeWindow()
    installGlobalErrorReporting(reporter, target)

    target.dispatchEvent(Object.assign(new Event('error'), { message: 'Script error.' }))
    expect(sent[0].payload.message).toBe('Script error.')
  })

  it('sends the folded repeats when the page is hidden', () => {
    const { reporter, sent } = setup()
    const target = fakeWindow()
    installGlobalErrorReporting(reporter, target)
    const boom = () => new Error('boom')
    reporter.report(boom())
    reporter.report(boom())

    target.dispatchEvent(new Event('pagehide'))
    expect(sent.map((s) => s.payload.count)).toEqual([1, 1])
  })

  it('does nothing without a window (server rendering)', () => {
    const { reporter } = setup()
    expect(() => installGlobalErrorReporting(reporter, undefined)()).not.toThrow()
  })
})
