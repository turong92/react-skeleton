import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { createProfileMutation, removeProfileMutation, renameProfileMutation } from './mutations'
import { authorProfileKeys, listQuery, configQuery } from './queries'
import { profile, stubApi } from './test/fixtures'

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
const invalidated = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([filter]) => (filter as { queryKey: unknown }).queryKey)

describe('authorProfileKeys / query definitions', () => {
  it('one root with the config and the list under it', () => {
    expect(authorProfileKeys.all).toEqual(['author-profile'])
    expect(authorProfileKeys.config()).toEqual(['author-profile', 'config'])
    expect(authorProfileKeys.list()).toEqual(['author-profile', 'list'])
  })

  it('each query asks the api for exactly its thing', async () => {
    const calls: string[] = []
    const api = stubApi({
      getConfig: async () => (calls.push('config'), { maxPerAccount: 5, nameMaxLength: 60 }),
      list: async () => (calls.push('list'), []),
    })
    await configQuery(api).queryFn()
    await listQuery(api).queryFn()
    expect(calls).toEqual(['config', 'list'])
  })
})

describe('profile mutations — every change refetches the list', () => {
  it('create: sends the name with the idempotency key and invalidates the list', async () => {
    const client = newClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const create = vi.fn(async () => profile('prf_a', 'Ann'))
    await new MutationObserver(client, createProfileMutation(client, stubApi({ create }))).mutate({
      name: 'Ann',
      idempotencyKey: 'k1',
    })
    expect(create).toHaveBeenCalledWith({ name: 'Ann' }, { idempotencyKey: 'k1' })
    expect(invalidated(spy)).toEqual([authorProfileKeys.list()])
  })

  it('rename: calls PATCH with id + name and invalidates the list', async () => {
    const client = newClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const rename = vi.fn(async () => profile('prf_a', 'Zed'))
    await new MutationObserver(client, renameProfileMutation(client, stubApi({ rename }))).mutate({
      id: 'prf_a',
      name: 'Zed',
    })
    expect(rename).toHaveBeenCalledWith('prf_a', { name: 'Zed' })
    expect(invalidated(spy)).toEqual([authorProfileKeys.list()])
  })

  it('remove: calls DELETE and invalidates the list', async () => {
    const client = newClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const remove = vi.fn(async () => undefined)
    await new MutationObserver(client, removeProfileMutation(client, stubApi({ remove }))).mutate(
      'prf_a',
    )
    expect(remove).toHaveBeenCalledWith('prf_a')
    expect(invalidated(spy)).toEqual([authorProfileKeys.list()])
  })

  it('rename and remove also refresh the keys the app names (e.g. board threads, where the name is read at display time)', async () => {
    const client = newClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    await new MutationObserver(
      client,
      renameProfileMutation(client, stubApi({ rename: async () => profile('prf_a', 'Z') }), [
        ['board'],
      ]),
    ).mutate({ id: 'prf_a', name: 'Z' })
    await new MutationObserver(
      client,
      removeProfileMutation(client, stubApi({ remove: async () => undefined }), [['board']]),
    ).mutate('prf_a')
    expect(invalidated(spy)).toEqual([
      authorProfileKeys.list(),
      ['board'],
      authorProfileKeys.list(),
      ['board'],
    ])
  })
})
