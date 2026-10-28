import { describe, expect, it } from 'vitest'
import { createAccountSearch } from './searchAccounts'

type Query = { email?: string; loginId?: string; size?: number }
const account = (id: string, email: string | null, loginId: string | null = null) => ({
  id,
  email,
  loginId,
})

function fakeApi(rows: Record<string, ReturnType<typeof account>[]>) {
  const calls: Query[] = []
  return {
    calls,
    api: {
      list: async (query: Query = {}) => {
        calls.push(query)
        const key = query.email !== undefined ? `email:${query.email}` : `loginId:${query.loginId}`
        return { values: rows[key] ?? [], pagination: {}, meta: {} } as never
      },
    },
  }
}

describe('createAccountSearch (existing GET /admin/accounts, no new API)', () => {
  it('an @ means an email: one call by email', async () => {
    const { api, calls } = fakeApi({ 'email:ada@x.io': [account('a1', 'ada@x.io', 'ada')] })
    await expect(createAccountSearch(api)('ada@x.io')).resolves.toEqual([
      { id: 'a1', email: 'ada@x.io', loginId: 'ada' },
    ])
    expect(calls).toEqual([{ email: 'ada@x.io', size: 10 }])
  })

  it('without an @ it asks by exact login id and by email piece, and merges without duplicates', async () => {
    const { api, calls } = fakeApi({
      'loginId:ada': [account('a1', 'ada@x.io', 'ada')],
      'email:ada': [account('a1', 'ada@x.io', 'ada'), account('a2', 'adam@x.io')],
    })
    const found = await createAccountSearch(api)(' ada ')
    expect(found.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(found[1]).toEqual({ id: 'a2', email: 'adam@x.io', loginId: null })
    expect(calls).toHaveLength(2)
  })

  it('an empty query asks nothing', async () => {
    const { api, calls } = fakeApi({})
    await expect(createAccountSearch(api)('  ')).resolves.toEqual([])
    expect(calls).toEqual([])
  })
})
