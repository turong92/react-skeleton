import { describe, expect, it } from 'vitest'
import {
  canConnectNotificationWebSocket,
  createNotificationConnectFrame,
  createNotificationDisconnectFrame,
  createNotificationSubscribeFrames,
  parseNotificationMessage,
} from './notificationStompSession'

describe('notificationStompSession', () => {
  it('creates a CONNECT frame with bearer authorization when access token is present', () => {
    expect(
      createNotificationConnectFrame('ws://localhost:18080/ws/notifications', {
        accessToken: 'token-1',
        devLogin: { email: 'user@example.com' },
      }),
    ).toEqual({
      command: 'CONNECT',
      headers: {
        Authorization: 'Bearer token-1',
        'accept-version': '1.2',
        'heart-beat': '10000,10000',
        host: 'localhost:18080',
      },
    })
  })

  it('does not translate dev login values into websocket authentication headers', () => {
    expect(
      createNotificationConnectFrame('wss://api.example.com/ws/notifications', {
        accessToken: '',
        devLogin: { accountId: 'acc_user', email: 'user@example.com' },
      }),
    ).toEqual({
      command: 'CONNECT',
      headers: {
        'accept-version': '1.2',
        'heart-beat': '10000,10000',
        host: 'api.example.com',
      },
    })
  })

  it('requires a non-empty bearer token for the standard websocket smoke flow', () => {
    expect(canConnectNotificationWebSocket('')).toBe(false)
    expect(canConnectNotificationWebSocket('   ')).toBe(false)
    expect(canConnectNotificationWebSocket('token-1')).toBe(true)
    expect(canConnectNotificationWebSocket('Bearer token-1')).toBe(true)
  })

  it('creates topic and user notification subscriptions', () => {
    expect(createNotificationSubscribeFrames('demo')).toEqual([
      {
        command: 'SUBSCRIBE',
        headers: {
          ack: 'auto',
          destination: '/topic/notifications/demo',
          id: 'notifications-topic-demo',
        },
      },
      {
        command: 'SUBSCRIBE',
        headers: {
          ack: 'auto',
          destination: '/user/queue/notifications',
          id: 'notifications-user',
        },
      },
    ])
  })

  it('adds trace headers to every notification subscription when provided', () => {
    expect(
      createNotificationSubscribeFrames('demo', {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        'X-Trace-Id': '4bf92f3577b34da6a3ce929d0e0e4736',
      }),
    ).toEqual([
      {
        command: 'SUBSCRIBE',
        headers: {
          ack: 'auto',
          destination: '/topic/notifications/demo',
          id: 'notifications-topic-demo',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          'X-Trace-Id': '4bf92f3577b34da6a3ce929d0e0e4736',
        },
      },
      {
        command: 'SUBSCRIBE',
        headers: {
          ack: 'auto',
          destination: '/user/queue/notifications',
          id: 'notifications-user',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          'X-Trace-Id': '4bf92f3577b34da6a3ce929d0e0e4736',
        },
      },
    ])
  })

  it('adds trace headers to disconnect frames when provided', () => {
    expect(
      createNotificationDisconnectFrame({
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        'X-Trace-Id': '4bf92f3577b34da6a3ce929d0e0e4736',
      }),
    ).toEqual({
      command: 'DISCONNECT',
      headers: {
        receipt: 'disconnect',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        'X-Trace-Id': '4bf92f3577b34da6a3ce929d0e0e4736',
      },
    })
  })

  it('parses JSON notification message frames', () => {
    expect(
      parseNotificationMessage({
        command: 'MESSAGE',
        headers: { destination: '/topic/notifications/demo' },
        body: '{"eventId":"event-1","topic":"demo"}',
      }),
    ).toEqual({
      destination: '/topic/notifications/demo',
      value: { eventId: 'event-1', topic: 'demo' },
    })
  })
})
