import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIFICATION_RECONNECT_POLICY,
  nextNotificationReconnectDelay,
  shouldRetryNotificationReconnect,
} from './notificationReconnectPolicy'

describe('notificationReconnectPolicy', () => {
  it('uses capped exponential backoff delays', () => {
    expect(nextNotificationReconnectDelay(1)).toBe(1_000)
    expect(nextNotificationReconnectDelay(2)).toBe(2_000)
    expect(nextNotificationReconnectDelay(3)).toBe(4_000)
    expect(nextNotificationReconnectDelay(8)).toBe(DEFAULT_NOTIFICATION_RECONNECT_POLICY.maxDelayMs)
  })

  it('honors custom retry limits', () => {
    const policy = {
      initialDelayMs: 500,
      maxDelayMs: 5_000,
      multiplier: 2,
      maxAttempts: 3,
    }

    expect(shouldRetryNotificationReconnect(3, policy)).toBe(true)
    expect(shouldRetryNotificationReconnect(4, policy)).toBe(false)
  })
})
