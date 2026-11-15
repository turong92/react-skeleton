import { ApiRequestError } from '@skeleton/api-client'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { isMaintenanceError, watchMaintenance } from './maintenance'

const apiError = (code: string, status: number) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't' }, 't', 's', 'p')
const maintenance = () => apiError('APP_CONTROL.MAINTENANCE', 503)

describe('isMaintenanceError', () => {
  it('only the 503 maintenance answer counts', () => {
    expect(isMaintenanceError(maintenance())).toBe(true)
    expect(isMaintenanceError(apiError('COMMON.INTERNAL', 503))).toBe(false)
    expect(isMaintenanceError(apiError('APP_CONTROL.MAINTENANCE', 500))).toBe(false)
    expect(isMaintenanceError(new Error('boom'))).toBe(false)
  })
})

describe('watchMaintenance — any call that gets the maintenance answer asks for a fresh config', () => {
  const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('a failing query, and a failing mutation, call back once each', async () => {
    const c = client()
    const onMaintenance = vi.fn()
    watchMaintenance(c, onMaintenance)

    await c
      .fetchQuery({
        queryKey: ['notes'],
        queryFn: () => Promise.reject(maintenance()),
      })
      .catch(() => undefined)
    expect(onMaintenance).toHaveBeenCalledTimes(1)

    await c
      .getMutationCache()
      .build(c, { mutationFn: () => Promise.reject(maintenance()) })
      .execute(undefined)
      .catch(() => undefined)
    expect(onMaintenance).toHaveBeenCalledTimes(2)
  })

  it('other failures, and the config query itself, do not', async () => {
    const c = client()
    const onMaintenance = vi.fn()
    watchMaintenance(c, onMaintenance)

    await c
      .fetchQuery({ queryKey: ['notes'], queryFn: () => Promise.reject(apiError('X', 500)) })
      .catch(() => undefined)
    await c
      .fetchQuery({
        queryKey: ['app-control', 'config'],
        queryFn: () => Promise.reject(maintenance()),
      })
      .catch(() => undefined)

    expect(onMaintenance).not.toHaveBeenCalled()
  })

  it('stops after the returned function is called', async () => {
    const c = client()
    const onMaintenance = vi.fn()
    watchMaintenance(c, onMaintenance)()

    await c
      .fetchQuery({ queryKey: ['notes'], queryFn: () => Promise.reject(maintenance()) })
      .catch(() => undefined)

    expect(onMaintenance).not.toHaveBeenCalled()
  })
})
