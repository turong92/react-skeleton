import type { ApiClient } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { helloQuery } from './useHello'

describe('helloQuery — the example TanStack Query hook', () => {
  it('calls GET /hello through the app client and returns the value', async () => {
    const calls: string[] = []
    const client = {
      value: async <T>(path: string) => {
        calls.push(path)
        return { message: 'hello', timestamp: '2026-06-12T00:00:00Z' } as T
      },
    } as Pick<ApiClient, 'value' | 'list' | 'noContent' | 'page'>

    const query = helloQuery(client)

    expect(query.queryKey).toEqual(['hello'])
    await expect(query.queryFn()).resolves.toEqual({
      message: 'hello',
      timestamp: '2026-06-12T00:00:00Z',
    })
    expect(calls).toEqual(['/hello'])
  })
})
