import {
  ApiRequestError,
  createApiClient,
  type AxiosAdapter,
  type ForbiddenContext,
} from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { createReconsentController } from './reconsent'
import type { MyConsents } from './types'

const missing = [{ type: 'terms', version: '2026-12-01', reason: 'STALE' as const }]
const settled: MyConsents = { blocked: false, items: [], missing: [] }
const blocked: MyConsents = { blocked: true, items: [], missing }

const apiError = (code: string, status: number, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't', data }, 't', 's', 'p')

function controllerWith(api: Partial<Parameters<typeof createReconsentController>[0]['api']> = {}) {
  const agree = vi.fn(async (): Promise<MyConsents> => settled)
  const myConsents = vi.fn(async (): Promise<MyConsents> => blocked)
  const controller = createReconsentController({ api: { agree, myConsents, ...api } })
  return { controller, agree, myConsents }
}
const forbidden = (path = '/notes', code = 'LEGAL.RECONSENT_REQUIRED'): ForbiddenContext => ({
  path,
  method: 'GET',
  error: apiError(code, 403, { missing }),
})

describe('createReconsentController', () => {
  it('ignores every 403 that is not the re-consent one, and the paths the server never blocks', async () => {
    const { controller } = controllerWith()
    expect(await controller.recover(forbidden('/notes', 'COMMON.FORBIDDEN'))).toBe(false)
    expect(await controller.recover(forbidden('/account/me'))).toBe(false)
    expect(await controller.recover(forbidden('/legal/consents'))).toBe(false)
    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('a re-consent 403 opens the prompt with what the server wants and waits; agreeing resolves it true', async () => {
    const { controller, agree } = controllerWith()
    const seen: unknown[] = []
    controller.subscribe(() => seen.push(controller.getState()))
    const waiting = controller.recover(forbidden())
    expect(controller.getState()).toMatchObject({
      status: 'required',
      missing,
      origin: 'forbidden',
    })
    let resolved = false
    void waiting.then(() => (resolved = true))
    await Promise.resolve()
    expect(resolved).toBe(false)

    await controller.agree([{ type: 'terms', version: '2026-12-01', locale: 'ko' }])
    expect(agree).toHaveBeenCalledWith(
      [{ type: 'terms', version: '2026-12-01', locale: 'ko' }],
      're-consent',
    )
    await expect(waiting).resolves.toBe(true)
    expect(controller.getState()).toEqual({ status: 'idle' })
    expect(seen.length).toBeGreaterThan(0)
  })

  it('requests that fail together share one prompt and are all released by one agreement', async () => {
    const { controller } = controllerWith()
    const a = controller.recover(forbidden('/a'))
    const b = controller.recover(forbidden('/b'))
    await controller.agree([{ type: 'terms', version: '2026-12-01' }])
    await expect(Promise.all([a, b])).resolves.toEqual([true, true])
  })

  it('declining (the user leaves) releases the waiting requests with false: the original 403 reaches the caller', async () => {
    const { controller } = controllerWith()
    const waiting = controller.recover(forbidden())
    controller.decline()
    await expect(waiting).resolves.toBe(false)
    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('agreement that leaves something missing (a newer version in between) keeps the prompt open with the new list', async () => {
    const next = [{ type: 'privacy', version: 'v9', reason: 'STALE' as const }]
    const { controller } = controllerWith({
      agree: vi.fn(async () => ({ blocked: true, items: [], missing: next })),
    })
    const waiting = controller.recover(forbidden())
    await controller.agree([{ type: 'terms', version: '2026-12-01' }])
    expect(controller.getState()).toMatchObject({ status: 'required', missing: next })
    controller.decline()
    await expect(waiting).resolves.toBe(false)
  })

  it('a stale version (409) refreshes what is missing, keeps waiting, and tells the screen', async () => {
    const fresh = [{ type: 'terms', version: '2027-01-01', reason: 'STALE' as const }]
    const stale = apiError('LEGAL.VERSION_STALE', 409, {
      stale: [{ type: 'terms', requiredVersion: '2027-01-01' }],
    })
    const { controller } = controllerWith({
      agree: vi.fn(async () => {
        throw stale
      }),
      myConsents: vi.fn(async () => ({ blocked: true, items: [], missing: fresh })),
    })
    void controller.recover(forbidden())
    await expect(controller.agree([{ type: 'terms', version: '2026-12-01' }])).rejects.toBe(stale)
    expect(controller.getState()).toMatchObject({ status: 'required', missing: fresh })
  })

  describe('after a sign-in (social, magic link, password: the account may have been created without a consent)', () => {
    it('opens the prompt when GET /consents/me says blocked; agreeing is recorded as first-sign-in', async () => {
      const { controller, agree } = controllerWith()
      await controller.check()
      expect(controller.getState()).toMatchObject({
        status: 'required',
        missing,
        origin: 'sign-in',
      })
      await controller.agree([{ type: 'terms', version: '2026-12-01' }])
      expect(agree).toHaveBeenCalledWith(
        [{ type: 'terms', version: '2026-12-01' }],
        'first-sign-in',
      )
      expect(controller.getState()).toEqual({ status: 'idle' })
    })

    it('stays quiet when nothing is missing, and when the backend has no legal module or fails', async () => {
      const ok = controllerWith({ myConsents: vi.fn(async () => settled) })
      await ok.controller.check()
      expect(ok.controller.getState()).toEqual({ status: 'idle' })
      const gone = controllerWith({
        myConsents: vi.fn(async () => {
          throw apiError('COMMON.NOT_FOUND', 404)
        }),
      })
      await expect(gone.controller.check()).resolves.toBeUndefined()
      expect(gone.controller.getState()).toEqual({ status: 'idle' })
    })
  })

  it('works as the api-client recoverForbidden: the failed call is sent again after the agreement', async () => {
    const { controller } = controllerWith()
    let calls = 0
    const adapter = (async (config: Parameters<AxiosAdapter>[0]) => {
      calls += 1
      return calls === 1
        ? {
            status: 403,
            statusText: 'Forbidden',
            headers: {},
            config,
            data: {
              code: 'LEGAL.RECONSENT_REQUIRED',
              title: 'x',
              status: 403,
              timestamp: 't',
              data: { missing },
            },
          }
        : {
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            data: { value: 'notes', meta: { timestamp: 't' } },
          }
    }) as unknown as AxiosAdapter
    const client = createApiClient({
      baseUrl: '/api/v1',
      adapter,
      getAuthHeaders: () => ({ Authorization: 'Bearer t' }),
      recoverForbidden: controller.recover,
    })
    const result = client.value<string>('/notes')
    await vi.waitFor(() => expect(controller.getState().status).toBe('required'))
    await controller.agree([{ type: 'terms', version: '2026-12-01' }])
    await expect(result).resolves.toBe('notes')
    expect(calls).toBe(2)
  })

  it('takes the api lazily — the api client needs the controller (recoverForbidden) before the legal api can exist', async () => {
    const agree = vi.fn(async (): Promise<MyConsents> => settled)
    const bound: { api?: { agree: typeof agree; myConsents: () => Promise<MyConsents> } } = {}
    const controller = createReconsentController({ api: () => bound.api! })
    bound.api = { agree, myConsents: async () => blocked }
    await controller.check()
    expect(controller.getState()).toMatchObject({ status: 'required' })
    await controller.agree([{ type: 'terms', version: '2026-12-01' }])
    expect(agree).toHaveBeenCalledTimes(1)
  })
})
