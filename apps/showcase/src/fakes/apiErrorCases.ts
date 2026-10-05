import {
  ErrorCodes,
  createApiClient,
  isErrorCode,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from '@skeleton/api-client'

export type ErrorCase = {
  path: string
  status: number
  code: string
  isInvalidCredentials: boolean
}

const problem = (status: number, code: string, title: string) => ({
  code,
  title,
  status,
  timestamp: '2026-01-01T00:00:00Z',
})

/** 경로마다 다른 응답을 주는 가짜 어댑터 — 네트워크 실패는 던진다 */
const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const reply = (status: number, data: unknown) => ({
    config,
    status,
    statusText: '',
    headers: {},
    data,
  })
  if (config.url === '/auth/login')
    return reply(401, problem(401, ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid credentials'))
  if (config.url === '/missing')
    return reply(404, problem(404, ErrorCodes.COMMON_NOT_FOUND, 'Not found'))
  throw new Error('offline')
}

/** 실제 `createApiClient` 로 세 번 실패시켜 에러 코드로 갈라 본다 */
export async function runApiErrorCases(): Promise<ErrorCase[]> {
  const client = createApiClient({ baseUrl: '/api/v1', adapter })
  const results: ErrorCase[] = []
  for (const path of ['/auth/login', '/missing', '/offline']) {
    const error = await client.value(path).catch((caught: unknown) => caught)
    const apiError = (error as { apiError: { status: number; code: string } }).apiError
    results.push({
      path,
      status: apiError.status,
      code: apiError.code,
      isInvalidCredentials: isErrorCode(error, ErrorCodes.AUTH_INVALID_CREDENTIALS),
    })
  }
  return results
}
