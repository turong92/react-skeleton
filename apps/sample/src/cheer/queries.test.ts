import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { CheerApi } from './cheerApi'
import { cheerKeys, cheerOptionsQuery, invalidateCheers, myCheersQuery } from './queries'

const api = {
  options: async () => [{ itemRef: 'cheer-3000' }],
  mine: async (params: unknown) => ({ called: 'mine', params }),
} as unknown as CheerApi

describe('cheer queries', () => {
  it('keys nest under one root so a payment change can refresh the cheer list in one call', () => {
    expect(cheerKeys.options()).toEqual(['cheers', 'options'])
    expect(cheerKeys.mine({ size: 10 })).toEqual(['cheers', 'mine', { size: 10 }])
  })

  it('the options query calls the api once and keeps nothing else in its key', async () => {
    const query = cheerOptionsQuery(api)
    expect(query.queryKey).toEqual(['cheers', 'options'])
    await expect(query.queryFn()).resolves.toEqual([{ itemRef: 'cheer-3000' }])
  })

  it('the list query pages by the cursor the server gave (first page has none)', async () => {
    const query = myCheersQuery(api, { size: 10 })
    await expect(query.queryFn({ pageParam: undefined })).resolves.toMatchObject({
      params: { size: 10 },
    })
    await expect(query.queryFn({ pageParam: 'c9' })).resolves.toMatchObject({
      params: { size: 10, cursor: 'c9' },
    })
    expect(query.getNextPageParam({ cursor: { hasNext: true, nextCursor: 'c2' } } as never)).toBe(
      'c2',
    )
    expect(query.getNextPageParam({ cursor: { hasNext: false, nextCursor: 'c2' } } as never)).toBe(
      undefined,
    )
  })

  it('invalidateCheers marks the cheer queries stale and leaves the others alone', async () => {
    const client = new QueryClient()
    client.setQueryData(cheerKeys.mine({}), 1)
    client.setQueryData(['payment', 'orders'], 2)
    await invalidateCheers(client)
    expect(client.getQueryState(cheerKeys.mine({}))?.isInvalidated).toBe(true)
    expect(client.getQueryState(['payment', 'orders'])?.isInvalidated).toBeFalsy()
  })
})
