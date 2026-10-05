import { describe, expect, it } from 'vitest'
import { apiConfigFromEnv } from './env'

describe('apiConfigFromEnv', () => {
  it('falls back to /api/v1, 15s timeout and no retry when nothing is set', () => {
    expect(apiConfigFromEnv({})).toEqual({
      baseUrl: '/api/v1',
      timeoutMs: 15_000,
      retry: { attempts: 0, delayMs: 150 },
    })
  })

  it('reads the VITE_API_* variables and trims trailing slashes from the base url', () => {
    expect(
      apiConfigFromEnv({
        VITE_API_BASE_URL: ' http://localhost:18080/api/v1/ ',
        VITE_API_TIMEOUT_MS: '4000',
        VITE_API_RETRY_ATTEMPTS: '2',
        VITE_API_RETRY_DELAY_MS: '0',
      }),
    ).toEqual({
      baseUrl: 'http://localhost:18080/api/v1',
      timeoutMs: 4_000,
      retry: { attempts: 2, delayMs: 0 },
    })
  })

  it('ignores blank and non-numeric values and non-string env values', () => {
    expect(
      apiConfigFromEnv({
        VITE_API_BASE_URL: '   ',
        VITE_API_TIMEOUT_MS: 'soon',
        VITE_API_RETRY_ATTEMPTS: '',
        VITE_API_RETRY_DELAY_MS: true,
      }),
    ).toEqual({ baseUrl: '/api/v1', timeoutMs: 15_000, retry: { attempts: 0, delayMs: 150 } })
  })
})
