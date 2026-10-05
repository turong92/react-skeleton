import type { SseResponseInfo, StompDiagnostic } from '@skeleton/realtime'
import { describe, expect, it } from 'vitest'
import { exchangeFromSseResponse, exchangeFromStompDiagnostic } from './realtimeExchanges'

const traceContext = {
  traceId: '0123456789abcdef0123456789abcdef',
  spanId: 'fedcba9876543210',
  traceparent: '00-0123456789abcdef0123456789abcdef-fedcba9876543210-01',
}

describe('exchangeFromSseResponse', () => {
  it('logs the SSE handshake with the server trace headers when present and redacted request headers', () => {
    const info: SseResponseInfo = {
      response: new Response(null, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'X-Trace-Id': 'server-trace',
          'X-Span-Id': 'server-span',
        },
      }),
      request: {
        url: 'http://localhost:8080/api/v1/notifications/sse?topic=demo',
        headers: new Headers({
          Accept: 'text/event-stream',
          Authorization: 'Bearer secret',
          traceparent: traceContext.traceparent,
        }),
      },
      traceContext,
      durationMs: 12,
    }

    expect(exchangeFromSseResponse(info, '/notifications/sse?topic=demo')).toEqual({
      label: 'notifications.sse',
      method: 'GET',
      path: '/notifications/sse?topic=demo',
      status: 200,
      durationMs: 12,
      traceId: 'server-trace',
      spanId: 'server-span',
      request: {
        headers: {
          accept: 'text/event-stream',
          authorization: 'Bearer ...',
          traceparent: traceContext.traceparent,
        },
      },
      response: { contentType: 'text/event-stream' },
    })
  })

  it('falls back to the client trace id and no span when the server sent none', () => {
    const exchange = exchangeFromSseResponse(
      {
        response: new Response(null, { status: 503 }),
        request: { url: 'http://x/sse', headers: new Headers() },
        traceContext,
        durationMs: 1,
      },
      '/sse',
    )
    expect(exchange.traceId).toBe(traceContext.traceId)
    expect(exchange.spanId).toBeUndefined()
    expect(exchange.status).toBe(503)
  })
})

describe('exchangeFromStompDiagnostic', () => {
  it('blocked: toast + a CONNECT exchange explaining the missing token', () => {
    const result = exchangeFromStompDiagnostic({
      type: 'blocked',
      reason: 'missing-token',
      traceContext,
    })
    expect(result.toast).toBe('websocket requires bearer token')
    expect(result.exchange).toEqual({
      label: 'notifications.websocket.blocked',
      method: 'CONNECT',
      path: '/ws/notifications',
      status: undefined,
      durationMs: 0,
      traceId: traceContext.traceId,
      request: {
        headers: { traceparent: traceContext.traceparent, 'X-Trace-Id': traceContext.traceId },
      },
      error: {
        code: 'MISSING_WEBSOCKET_TOKEN',
        message: 'Run auth.login before opening the WebSocket smoke connection.',
      },
    })
  })

  it('socket-open: a 101 exchange with the CONNECT headers summarised and the token hidden', () => {
    const diagnostic: StompDiagnostic = {
      type: 'socket-open',
      url: 'ws://localhost:18080/ws/notifications',
      headers: {
        Authorization: 'Bearer secret',
        'accept-version': '1.2',
        'heart-beat': '10000,10000',
        host: 'localhost:18080',
        traceparent: traceContext.traceparent,
        'X-Trace-Id': traceContext.traceId,
        'ignored-header': 'x',
      },
      traceContext,
      durationMs: 7,
    }
    const result = exchangeFromStompDiagnostic(diagnostic)
    expect(result.toast).toBeUndefined()
    expect(result.exchange).toEqual({
      label: 'notifications.websocket',
      method: 'GET',
      path: '/ws/notifications',
      status: 101,
      durationMs: 7,
      traceId: traceContext.traceId,
      request: {
        url: 'ws://localhost:18080/ws/notifications',
        headers: {
          Authorization: 'Bearer ...',
          'accept-version': '1.2',
          'heart-beat': '10000,10000',
          traceparent: traceContext.traceparent,
          'X-Trace-Id': traceContext.traceId,
          host: 'localhost:18080',
        },
      },
      response: { protocol: 'stomp.v12', phase: 'socket-open' },
    })
  })

  it('stomp-error: toast + an error exchange with the frame body (or message) as the error', () => {
    const withBody = exchangeFromStompDiagnostic({
      type: 'stomp-error',
      frame: {
        command: 'ERROR',
        headers: { message: 'bad token', destination: '/x' },
        body: 'denied',
      },
      traceContext,
      durationMs: 3,
    })
    expect(withBody.toast).toBe('websocket error')
    expect(withBody.exchange).toMatchObject({
      label: 'notifications.websocket.error',
      method: 'MESSAGE',
      path: 'bad token',
      request: { destination: '/x' },
      error: 'denied',
    })

    const bodyless = exchangeFromStompDiagnostic({
      type: 'stomp-error',
      frame: { command: 'ERROR', headers: {}, body: '' },
      traceContext,
      durationMs: 3,
    })
    expect(bodyless.exchange).toMatchObject({ path: '/ws/notifications', error: undefined })
  })

  it('socket-error: only a toast; exception: hands the error back for showApiError', () => {
    expect(exchangeFromStompDiagnostic({ type: 'socket-error' })).toEqual({
      toast: 'websocket connection failed',
    })
    const error = new Error('bad url')
    expect(exchangeFromStompDiagnostic({ type: 'exception', error })).toEqual({ error })
  })
})
