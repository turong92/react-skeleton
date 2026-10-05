import type { SseResponseInfo, StompDiagnostic } from '@skeleton/realtime'
import type { Exchange } from './workbenchTypes'
import { headersToObject, redactHeaders } from './workbenchUtils'

type NewExchange = Omit<Exchange, 'id' | 'at'>

/** SSE 핸드셰이크 → 화면 로그 한 줄. `path` 는 로그에 적을 API 상대 경로 */
export function exchangeFromSseResponse(
  { response, request, traceContext, durationMs }: SseResponseInfo,
  path: string,
): NewExchange {
  return {
    label: 'notifications.sse',
    method: 'GET',
    path,
    status: response.status,
    durationMs,
    traceId: response.headers.get('X-Trace-Id') ?? traceContext.traceId,
    spanId: response.headers.get('X-Span-Id') ?? undefined,
    request: { headers: redactHeaders(headersToObject(request.headers)) },
    response: { contentType: response.headers.get('content-type') },
  }
}

export type StompDiagnosticView = {
  /** 띄울 토스트 문구 */
  toast?: string
  exchange?: NewExchange
  /** `showApiError` 로 보여 줄 예외 */
  error?: unknown
}

/** STOMP 진단 이벤트 → 토스트 · 화면 로그 · 예외 */
export function exchangeFromStompDiagnostic(diagnostic: StompDiagnostic): StompDiagnosticView {
  switch (diagnostic.type) {
    case 'blocked':
      return {
        toast: 'websocket requires bearer token',
        exchange: {
          label: 'notifications.websocket.blocked',
          method: 'CONNECT',
          path: '/ws/notifications',
          status: undefined,
          durationMs: 0,
          traceId: diagnostic.traceContext.traceId,
          request: {
            headers: {
              traceparent: diagnostic.traceContext.traceparent,
              'X-Trace-Id': diagnostic.traceContext.traceId,
            },
          },
          error: {
            code: 'MISSING_WEBSOCKET_TOKEN',
            message: 'Run auth.login before opening the WebSocket smoke connection.',
          },
        },
      }
    case 'socket-open':
      return {
        exchange: {
          label: 'notifications.websocket',
          method: 'GET',
          path: '/ws/notifications',
          status: 101,
          durationMs: diagnostic.durationMs,
          traceId: diagnostic.traceContext.traceId,
          request: { url: diagnostic.url, headers: summarizeStompHeaders(diagnostic.headers) },
          response: { protocol: 'stomp.v12', phase: 'socket-open' },
        },
      }
    case 'stomp-error': {
      const { frame } = diagnostic
      return {
        toast: 'websocket error',
        exchange: {
          label: 'notifications.websocket.error',
          method: 'MESSAGE',
          path: frame.headers.message ?? '/ws/notifications',
          status: undefined,
          durationMs: diagnostic.durationMs,
          traceId: diagnostic.traceContext.traceId,
          request: { destination: frame.headers.destination },
          error: frame.body || frame.headers.message || frame.headers['content-type'],
        },
      }
    }
    case 'socket-error':
      return { toast: 'websocket connection failed' }
    case 'exception':
      return { error: diagnostic.error }
  }
}

function summarizeStompHeaders(
  headers: Record<string, string | number | undefined> | undefined,
): Record<string, string> {
  return redactHeaders({
    Authorization: headers?.Authorization ? 'Bearer ...' : undefined,
    'X-Dev-Account-Id': stringHeader(headers?.['X-Dev-Account-Id']),
    'X-Dev-Username': stringHeader(headers?.['X-Dev-Username']),
    'X-Dev-Email': stringHeader(headers?.['X-Dev-Email']),
    'accept-version': stringHeader(headers?.['accept-version']),
    'heart-beat': stringHeader(headers?.['heart-beat']),
    traceparent: stringHeader(headers?.traceparent),
    'X-Trace-Id': stringHeader(headers?.['X-Trace-Id']),
    host: stringHeader(headers?.host),
  })
}

function stringHeader(value: string | number | undefined): string | undefined {
  return value === undefined ? undefined : String(value)
}
