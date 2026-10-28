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
    expect(calls).toEqual([{ email: 'ada@x.io', size: 11 }])
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

  it('a server that ignores loginId (login ids are off) and hands back arbitrary accounts adds none of them - only rows that match the query stay', async () => {
    const { api } = fakeApi({
      'loginId:ada': [account('x1', 'someone@x.io', 'other'), account('x2', 'else@x.io', null)],
      'email:ada': [account('a1', 'Ada@X.io', 'ADA')],
    })
    const found = await createAccountSearch(api)('Ada')
    expect(found.map((a) => a.id)).toEqual(['a1'])
  })

  it('an exact login id matches whatever the case', async () => {
    const { api } = fakeApi({
      'loginId:ada': [account('a1', null, 'Ada')],
      'email:ada': [],
    })
    expect((await createAccountSearch(api)('ADA')).map((a) => a.id)).toEqual(['a1'])
  })

  it('asks for one more than it shows, so the screen can say there are more', async () => {
    const many = Array.from({ length: 11 }, (_, i) => account(`m${i}`, `m${i}@x.io`))
    const { api } = fakeApi({ 'email:@x.io': many })
    expect(await createAccountSearch(api)('@x.io')).toHaveLength(11)
  })
})
