import type { DevLoginIdentity } from '../../api/types'
import type { ParsedStompFrame, StompFrame } from './stompFrames'

export type NotificationStompAuth = {
  accessToken: string
  devLogin: DevLoginIdentity
}

export type NotificationStompMessage = {
  destination?: string
  value: unknown
}

const TOPIC_PREFIX = '/topic/notifications'
const USER_DESTINATION = '/user/queue/notifications'

export function createNotificationConnectFrame(
  websocketUrl: string,
  auth: NotificationStompAuth,
): StompFrame {
  return {
    command: 'CONNECT',
    headers: {
      ...authHeaders(auth),
      'accept-version': '1.2',
      'heart-beat': '10000,10000',
      host: new URL(websocketUrl).host,
    },
  }
}

export function createNotificationSubscribeFrames(topic: string): StompFrame[] {
  const normalizedTopic = normalizeTopic(topic)
  return [
    {
      command: 'SUBSCRIBE',
      headers: {
        ack: 'auto',
        destination: `${TOPIC_PREFIX}/${normalizedTopic}`,
        id: `notifications-topic-${subscriptionId(normalizedTopic)}`,
      },
    },
    {
      command: 'SUBSCRIBE',
      headers: {
        ack: 'auto',
        destination: USER_DESTINATION,
        id: 'notifications-user',
      },
    },
  ]
}

export function parseNotificationMessage(
  frame: ParsedStompFrame,
): NotificationStompMessage | null {
  if (frame.command !== 'MESSAGE') return null
  return {
    destination: frame.headers.destination,
    value: parseJsonBody(frame.body),
  }
}

function authHeaders(auth: NotificationStompAuth): Record<string, string> {
  if (auth.accessToken) {
    return {
      Authorization: auth.accessToken.startsWith('Bearer ')
        ? auth.accessToken
        : `Bearer ${auth.accessToken}`,
    }
  }
  return {
    ...(auth.devLogin.accountId ? { 'X-Dev-Account-Id': auth.devLogin.accountId } : {}),
    ...(auth.devLogin.username ? { 'X-Dev-Username': auth.devLogin.username } : {}),
    ...(auth.devLogin.email ? { 'X-Dev-Email': auth.devLogin.email } : {}),
  }
}

function normalizeTopic(topic: string): string {
  return topic.trim().replace(/^\/+|\/+$/g, '') || 'demo'
}

function subscriptionId(topic: string): string {
  return topic.replace(/[^A-Za-z0-9_.-]/g, '-')
}

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}
