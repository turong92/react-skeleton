import { describe, expect, it } from 'vitest'
import { parseSseBlock } from './sseStream'

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
})
