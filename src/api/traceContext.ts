export type TraceContext = {
  traceId: string
  spanId: string
  traceparent: string
}

const VERSION = '00'
const DEFAULT_FLAGS = '01'
const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/

export function createTraceContext(traceId = createTraceId()): TraceContext {
  const normalizedTraceId = normalizeTraceId(traceId) ?? createTraceId()
  const spanId = createSpanId()
  return {
    traceId: normalizedTraceId,
    spanId,
    traceparent: `${VERSION}-${normalizedTraceId}-${spanId}-${DEFAULT_FLAGS}`,
  }
}

export function createTraceId(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

function createSpanId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16)
}

function normalizeTraceId(traceId: string): string | null {
  const normalized = traceId.toLowerCase()
  if (!TRACE_ID_PATTERN.test(normalized)) return null
  if ([...normalized].every((char) => char === '0')) return null
  return normalized
}
