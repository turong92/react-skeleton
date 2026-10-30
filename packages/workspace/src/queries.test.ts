import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import {
  bySlugQuery,
  invitationPreviewQuery,
  invitationsQuery,
  listQuery,
  membersQuery,
  shouldRetryResolve,
  workspaceKeys,
} from './queries'
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

describe('invitation queries', () => {
  it('pending invitations live under the workspace root; the list asks the api for its workspace', async () => {
    expect(workspaceKeys.invitations('ws_1')).toEqual(['workspace', 'invitations', 'ws_1'])
    const seen: string[] = []
    const query = invitationsQuery(
      stubApi({ invitations: async (id) => (seen.push(id), []) }),
      'ws_1',
    )
    await query.queryFn()
    expect(query.queryKey).toEqual(workspaceKeys.invitations('ws_1'))
    expect(seen).toEqual(['ws_1'])
  })

  it('the preview is asked once (the answer for a dead token never changes) and its 400 is spoken by the screen, not a toast', async () => {
    const seen: string[] = []
    const query = invitationPreviewQuery(
      stubApi({
        previewInvitation: async (token) => (seen.push(token), {} as never),
      }),
      'tok',
    )
    await query.queryFn()
    expect(seen).toEqual(['tok'])
    expect(query.retry).toBe(false)
    expect(query.meta).toEqual({ quietStatuses: [400, 404] })
    expect(query.queryKey[0]).toBe('workspace')
  })
})
