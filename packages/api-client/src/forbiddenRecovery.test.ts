import type { AxiosAdapter } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createApiClient, type ForbiddenContext } from './createApiClient'
import { ErrorCodes } from './errorCodes'

type Config = Parameters<AxiosAdapter>[0]

const forbidden = (config: Config, code = 'LEGAL.RECONSENT_REQUIRED') => ({
  status: 403,
  statusText: 'Forbidden',
  headers: {},
  config,
  data: {
    code,
    title: 'Re-consent required',
    status: 403,
    timestamp: 't',
    data: { missing: [{ type: 'terms', version: '2026-12-01', reason: 'STALE' }] },
  },
})
const ok = (config: Config) => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  data: { value: 'done', meta: { timestamp: 't' } },
})

function clientWith(
  answers: Array<(config: Config) => unknown>,
  recoverForbidden: Parameters<typeof createApiClient>[0]['recoverForbidden'],
) {
  let call = 0
  const adapter = vi.fn(async (config: Config) =>
    answers[Math.min(call++, answers.length - 1)](config),
  )
  const client = createApiClient({
    baseUrl: '/api/v1',
    adapter: adapter as unknown as AxiosAdapter,
    getAuthHeaders: () => ({ Authorization: 'Bearer t' }),
    recoverForbidden,
  })
  return { client, adapter }
}

describe('recoverForbidden (a 403 the app can fix by asking the user — legal re-consent)', () => {
  it('names the re-consent code', () => {
    expect(ErrorCodes.LEGAL_RECONSENT_REQUIRED).toBe('LEGAL.RECONSENT_REQUIRED')
    expect(ErrorCodes.LEGAL_CONSENT_REQUIRED).toBe('LEGAL.CONSENT_REQUIRED')
    expect(ErrorCodes.LEGAL_VERSION_STALE).toBe('LEGAL.VERSION_STALE')
    expect(ErrorCodes.LEGAL_WITHDRAWAL_NOT_ALLOWED).toBe('LEGAL.WITHDRAWAL_NOT_ALLOWED')
  })

  it('true → the same request is sent once more and its answer is the call result', async () => {
    const recover = vi.fn<(context: ForbiddenContext) => Promise<boolean>>(async () => true)
    const { client, adapter } = clientWith([forbidden, ok], recover)
    await expect(client.value<string>('/notes')).resolves.toBe('done')
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(recover).toHaveBeenCalledTimes(1)
    expect(recover.mock.calls[0][0]).toMatchObject({
      path: '/notes',
      method: 'GET',
      error: { apiError: { code: 'LEGAL.RECONSENT_REQUIRED', status: 403 } },
    })
  })

  it('false → the original 403 reaches the caller', async () => {
    const { client, adapter } = clientWith([forbidden], async () => false)
    await expect(client.value('/notes')).rejects.toMatchObject({ apiError: { status: 403 } })
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('retries only once even if the retry is forbidden again', async () => {
    const recover = vi.fn(async () => true)
    const { client, adapter } = clientWith([forbidden], recover)
    await expect(client.value('/notes')).rejects.toMatchObject({ apiError: { status: 403 } })
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(recover).toHaveBeenCalledTimes(1)
  })

  it('is not asked for requests that carry no sign-in (skipAuth), nor for other statuses', async () => {
    const recover = vi.fn(async () => true)
    const { client } = clientWith([forbidden], recover)
    await expect(client.value('/auth/login', { skipAuth: true })).rejects.toBeDefined()
    expect(recover).not.toHaveBeenCalled()
  })

  it('a throwing recovery surfaces its own error', async () => {
    const { client } = clientWith([forbidden], async () => {
      throw new Error('user left')
    })
    await expect(client.value('/notes')).rejects.toBeDefined()
  })
})
