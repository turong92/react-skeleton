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

  it('keeps data fresh for staleTime so a hydrated first render is not refetched at once (no flash, no second request)', () => {
    const fresh = createQueryClient({ onError: vi.fn(), staleTime: 30_000 })
    expect(fresh.getDefaultOptions().queries?.staleTime).toBe(30_000)
    const plain = createQueryClient({ onError: vi.fn() })
    expect(plain.getDefaultOptions().queries?.staleTime).toBeUndefined()
  })
})
