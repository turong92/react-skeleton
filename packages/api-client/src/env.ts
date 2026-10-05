import type { ApiRetryOptions } from './createApiClient'

export type ApiEnvConfig = {
  baseUrl: string
  timeoutMs: number
  retry: ApiRetryOptions & { delayMs: number }
}

const DEFAULT_BASE_URL = '/api/v1'
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_RETRY_DELAY_MS = 150

/**
 * `VITE_API_*` 환경변수 → `createApiClient` 설정. 이 패키지는 `import.meta.env` 를 읽지 않는다 —
 * 앱이 `apiConfigFromEnv(import.meta.env)` 로 넘긴다. 비었거나 숫자가 아닌 값은 기본값.
 */
export function apiConfigFromEnv(env: Record<string, unknown>): ApiEnvConfig {
  return {
    baseUrl: baseUrlFrom(env.VITE_API_BASE_URL),
    timeoutMs: numberFrom(env.VITE_API_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS,
    retry: {
      attempts: numberFrom(env.VITE_API_RETRY_ATTEMPTS) ?? 0,
      delayMs: numberFrom(env.VITE_API_RETRY_DELAY_MS) ?? DEFAULT_RETRY_DELAY_MS,
    },
  }
}

function baseUrlFrom(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}
