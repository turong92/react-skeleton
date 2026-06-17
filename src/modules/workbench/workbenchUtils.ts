import type { ApiRequestInit } from '../../api/client'

export function summarizeRequest(init: ApiRequestInit | undefined) {
  return {
    headers: redactHeaders({
      Authorization: init?.accessToken ? 'Bearer ...' : undefined,
      'Idempotency-Key': init?.idempotencyKey,
      'X-Dev-Account-Id': init?.devLogin?.accountId,
      'X-Dev-Username': init?.devLogin?.username,
      'X-Dev-Email': init?.devLogin?.email,
      'X-Break-Glass-Account-Id': init?.breakGlass?.accountId,
      'X-Break-Glass-Reason': init?.breakGlass?.reason,
      'X-Break-Glass-Secret': init?.breakGlass?.secret,
    }),
    body: init?.json,
  }
}

export function redactHeaders(headers: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([key, value]) => [key, isSensitiveKey(key) ? redactValue(key, value) : value]),
  )
}

export function redactSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item))
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? redactValue(key, nestedValue) : redactSensitiveData(nestedValue),
    ]),
  )
}

export function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function newIdempotencyKey(): string {
  return `fe-${crypto.randomUUID()}`
}

export function nowMs(): number {
  return performance.now()
}

function isSensitiveKey(key: string): boolean {
  return /authorization|token|secret|password|credential|api[-_]?key/i.test(key)
}

function redactValue(key: string, value: unknown): string {
  if (key.toLowerCase() === 'authorization' && String(value).startsWith('Bearer ')) {
    return 'Bearer ...'
  }
  return '[REDACTED]'
}
