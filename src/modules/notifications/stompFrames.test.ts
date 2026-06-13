import { describe, expect, it } from 'vitest'
import { encodeStompFrame, parseStompFrames, websocketUrlFromApiBase } from './stompFrames'

describe('stompFrames', () => {
  it('encodes a STOMP frame with headers and JSON body', () => {
    expect(
      encodeStompFrame({
        command: 'SEND',
        headers: {
          destination: '/app/probe',
          'content-type': 'application/json',
        },
        body: { topic: 'demo', type: 'probe' },
      }),
    ).toBe(
      'SEND\n' +
        'destination:/app/probe\n' +
        'content-type:application/json\n' +
        '\n' +
        '{"topic":"demo","type":"probe"}\u0000',
    )
  })

  it('parses complete STOMP frames and leaves incomplete buffer for later', () => {
    const parsed = parseStompFrames(
      'CONNECTED\nversion:1.2\n\n\u0000' +
        'MESSAGE\ndestination:/topic/notifications/demo\nmessage-id:m-1\n\n{"id":"event-1"}\u0000' +
        'MESSAGE\ndestination:/topic/notifications/demo\n\n',
    )

    expect(parsed.frames).toEqual([
      {
        command: 'CONNECTED',
        headers: { version: '1.2' },
        body: '',
      },
      {
        command: 'MESSAGE',
        headers: {
          destination: '/topic/notifications/demo',
          'message-id': 'm-1',
        },
        body: '{"id":"event-1"}',
      },
    ])
    expect(parsed.remaining).toBe('MESSAGE\ndestination:/topic/notifications/demo\n\n')
  })

  it('derives websocket endpoint from API base url', () => {
    expect(websocketUrlFromApiBase('http://localhost:18080/api/v1', '/ws/notifications')).toBe(
      'ws://localhost:18080/ws/notifications',
    )
    expect(websocketUrlFromApiBase('https://api.example.com/api/v1/', 'ws/notifications')).toBe(
      'wss://api.example.com/ws/notifications',
    )
  })
})
