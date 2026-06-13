import { describe, expect, it } from 'vitest'
import {
  createNotificationConnectFrame,
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

  it('falls back to dev login STOMP headers when access token is absent', () => {
    expect(
      createNotificationConnectFrame('wss://api.example.com/ws/notifications', {
        accessToken: '',
        devLogin: { accountId: 'acc_user', email: 'user@example.com' },
      }),
    ).toEqual({
      command: 'CONNECT',
      headers: {
        'X-Dev-Account-Id': 'acc_user',
        'X-Dev-Email': 'user@example.com',
        'accept-version': '1.2',
        'heart-beat': '10000,10000',
        host: 'api.example.com',
      },
    })
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
