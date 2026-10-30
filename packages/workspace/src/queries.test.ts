import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { bySlugQuery, listQuery, membersQuery, shouldRetryResolve, workspaceKeys } from './queries'
import { detail, stubApi, summary } from './test/fixtures'

const failure = (status: number) =>
  new ApiRequestError({ code: 'X', title: 'x', status } as never, 't', 's', 'p')

describe('workspaceKeys', () => {
  it('one root with everything under it', () => {
    expect(workspaceKeys.all).toEqual(['workspace'])
    expect(workspaceKeys.list()).toEqual(['workspace', 'list'])
    expect(workspaceKeys.bySlug('acme')).toEqual(['workspace', 'by-slug', 'acme'])
    expect(workspaceKeys.members('ws_1')).toEqual(['workspace', 'members', 'ws_1'])
  })
})

describe('query definitions ask the api for exactly their thing', () => {
  it('list, by-slug and members', async () => {
    const calls: string[] = []
    const api = stubApi({
      list: async () => (calls.push('list'), [summary()]),
      bySlug: async (slug) => (calls.push(`bySlug:${slug}`), detail()),
      members: async (id) => (calls.push(`members:${id}`), []),
    })
    await listQuery(api).queryFn()
    await bySlugQuery(api, 'old-name').queryFn()
    await membersQuery(api, 'ws_1').queryFn()
    expect(calls).toEqual(['list', 'bySlug:old-name', 'members:ws_1'])
  })
})

describe('resolving a slug', () => {
  it('does not retry a 404 (not found, not a member and closed look the same — asking again changes nothing)', () => {
    expect(shouldRetryResolve(0, failure(404))).toBe(false)
  })
  it('retries a network or server failure twice, then stops', () => {
    expect(shouldRetryResolve(0, failure(500))).toBe(true)
    expect(shouldRetryResolve(1, new Error('offline'))).toBe(true)
    expect(shouldRetryResolve(2, failure(500))).toBe(false)
  })
  it('marks the 404 as expected so the global error toast stays quiet (the screen says it)', () => {
    expect(bySlugQuery(stubApi(), 'x').meta).toEqual({ quietStatuses: [404] })
  })
})
