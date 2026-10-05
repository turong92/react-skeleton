import { describe, expect, it } from 'vitest'
import { createTraceContext, createTraceId } from './traceContext'

describe('traceContext', () => {
  it('creates a 32-hex trace id and a W3C traceparent with a fresh 16-hex span id', () => {
    const context = createTraceContext()
    expect(context.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(context.spanId).toMatch(/^[0-9a-f]{16}$/)
    expect(context.traceparent).toBe(`00-${context.traceId}-${context.spanId}-01`)
  })

  it('keeps a valid trace id (lower-cased) but a new span for each request', () => {
    const traceId = '0123456789ABCDEF0123456789abcdef'
    const first = createTraceContext(traceId)
    const second = createTraceContext(traceId)
    expect(first.traceId).toBe(traceId.toLowerCase())
    expect(first.spanId).not.toBe(second.spanId)
  })

  it('replaces an invalid or all-zero trace id instead of forwarding it', () => {
    expect(createTraceContext('not-a-trace-id').traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(createTraceContext('0'.repeat(32)).traceId).not.toBe('0'.repeat(32))
    expect(createTraceId()).not.toBe(createTraceId())
  })
})
