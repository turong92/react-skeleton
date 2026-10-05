export type NotificationReconnectPolicy = {
  initialDelayMs: number
  maxDelayMs: number
  multiplier: number
  maxAttempts?: number
}

export const DEFAULT_NOTIFICATION_RECONNECT_POLICY: NotificationReconnectPolicy = {
  initialDelayMs: 1_000,
  maxDelayMs: 15_000,
  multiplier: 2,
}

export function nextNotificationReconnectDelay(
  attempt: number,
  policy: NotificationReconnectPolicy = DEFAULT_NOTIFICATION_RECONNECT_POLICY,
): number {
  const normalizedAttempt = Math.max(1, attempt)
  const delay = policy.initialDelayMs * policy.multiplier ** (normalizedAttempt - 1)
  return Math.min(policy.maxDelayMs, delay)
}

export function shouldRetryNotificationReconnect(
  attempt: number,
  policy: NotificationReconnectPolicy = DEFAULT_NOTIFICATION_RECONNECT_POLICY,
): boolean {
  return policy.maxAttempts === undefined || attempt <= policy.maxAttempts
}
