import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import {
  createWorkspaceMutation,
  leaveWorkspaceMutation,
  removeMemberMutation,
  setMemberRoleMutation,
  transferOwnershipMutation,
  updateWorkspaceMutation,
} from './mutations'
import { workspaceKeys } from './queries'
import { detail, stubApi, summary } from './test/fixtures'

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
const invalidated = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([filter]) => (filter as { queryKey: unknown }).queryKey)

describe('workspace mutations', () => {
  it('create: sends name + slug with the key and refetches the list', async () => {
    const client = newClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const create = vi.fn(async () => summary())
    await new MutationObserver(client, createWorkspaceMutation(client, stubApi({ create }))).mutate(
      { name: 'Acme', slug: 'acme', idempotencyKey: 'k1' },
    )
    expect(create).toHaveBeenCalledWith({ name: 'Acme', slug: 'acme' }, { idempotencyKey: 'k1' })
    expect(invalidated(spy)).toEqual([workspaceKeys.list()])
  })

  it('update: seeds the cache under the NEW slug, so the screen does not blank while the address is swapped', async () => {
    const client = newClient()
    const renamed = detail({ slug: 'new-name', name: 'Acme Inc' })
    const update = vi.fn(async () => renamed)
    await new MutationObserver(
      client,
      updateWorkspaceMutation(client, stubApi({ update }), 'ws_1'),
    ).mutate({ slug: 'new-name', name: 'Acme Inc' })
    expect(update).toHaveBeenCalledWith('ws_1', { slug: 'new-name', name: 'Acme Inc' })
    expect(client.getQueryData(workspaceKeys.bySlug('new-name'))).toEqual(renamed)
  })

  it('role, remove and transfer refetch everything of the workspace (counts and roles change)', async () => {
    for (const run of [
      (c: QueryClient, api: ReturnType<typeof stubApi>) =>
        new MutationObserver(c, setMemberRoleMutation(c, api, 'ws_1')).mutate({
          accountId: 'acc_2',
          role: 'ADMIN',
        }),
      (c: QueryClient, api: ReturnType<typeof stubApi>) =>
        new MutationObserver(c, removeMemberMutation(c, api, 'ws_1')).mutate('acc_2'),
      (c: QueryClient, api: ReturnType<typeof stubApi>) =>
        new MutationObserver(c, transferOwnershipMutation(c, api, 'ws_1')).mutate('acc_2'),
    ]) {
      const client = newClient()
      const spy = vi.spyOn(client, 'invalidateQueries')
      const ok = async () => undefined
      await run(client, stubApi({ setMemberRole: ok, removeMember: ok, transfer: ok }))
      expect(invalidated(spy)).toEqual([workspaceKeys.all])
    }
  })

  it('leave: refetches only the list — the workspace itself would answer 404 and flash "not found" before the app navigates away', async () => {
    const client = newClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const leave = vi.fn(async () => undefined)
    await new MutationObserver(
      client,
      leaveWorkspaceMutation(client, stubApi({ leave }), 'ws_1'),
    ).mutate(undefined)
    expect(leave).toHaveBeenCalledWith('ws_1')
    expect(invalidated(spy)).toEqual([workspaceKeys.list()])
  })
})
