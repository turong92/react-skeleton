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
      .map(([key, value]) => [key, key.toLowerCase().includes('secret') ? '[REDACTED]' : value]),
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
