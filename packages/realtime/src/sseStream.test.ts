import { describe, expect, it } from 'vitest'
import { parseSseBlock, readSseStream } from './sseStream'

describe('sseStream', () => {
  it('parses named JSON server-sent events', () => {
    expect(parseSseBlock('id: event-1\nevent: connected\ndata: {"topics":["demo"]}')).toEqual({
      id: 'event-1',
      name: 'connected',
      data: { topics: ['demo'] },
    })
  })

  it('ignores keepalive blocks without data', () => {
    expect(parseSseBlock(': keepalive')).toBeNull()
  })

  it('calls onChunk for every received chunk, heartbeat comments included', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(': keepalive\n\n'))
        controller.enqueue(encoder.encode('data: {"n":1}\n\n'))
        controller.close()
      },
    })
    let chunks = 0
    const events: unknown[] = []
    await readSseStream(
      body,
      new AbortController().signal,
      (e) => events.push(e),
      () => chunks++,
    )
    expect(chunks).toBe(2)
    expect(events).toHaveLength(1)
  })
})
