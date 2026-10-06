import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from './createQueryClient'

describe('createQueryClient — error toast wiring', () => {
  it('reports a failed query to onError', async () => {
    const onError = vi.fn()
    const client = createQueryClient({ onError })
    const failure = new Error('query failed')
    await client
      .fetchQuery({
        queryKey: ['boom'],
        queryFn: () => Promise.reject(failure),
        retry: false,
      })
      .catch(() => undefined)
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('reports a failed mutation to onError', async () => {
    const onError = vi.fn()
    const client = createQueryClient({ onError })
    const failure = new Error('mutation failed')
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(failure) })
      .execute(undefined)
      .catch(() => undefined)
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('stays quiet for successes', async () => {
    const onError = vi.fn()
    const client = createQueryClient({ onError })
    await expect(client.fetchQuery({ queryKey: ['ok'], queryFn: () => 1 })).resolves.toBe(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('a query that marks statuses as expected (meta.quietStatuses — e.g. a backend without the legal module answering 404) is not reported; other failures of it still are', async () => {
    const onError = vi.fn()
    const client = createQueryClient({ onError })
    const apiError = (status: number) =>
      Object.assign(new Error('x'), { apiError: { status, code: 'X', title: 'x', timestamp: 't' } })
    const run = (key: string, error: unknown, meta?: Record<string, unknown>) =>
      client
        .fetchQuery({ queryKey: [key], queryFn: () => Promise.reject(error), retry: false, meta })
        .catch(() => undefined)
    await run('quiet', apiError(404), { quietStatuses: [404] })
    expect(onError).not.toHaveBeenCalled()
    await run('other-status', apiError(500), { quietStatuses: [404] })
    expect(onError).toHaveBeenCalledTimes(1)
    await run('no-meta', apiError(404))
    expect(onError).toHaveBeenCalledTimes(2)
  })
})
