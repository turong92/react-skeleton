import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { invalidateNotes, noteQuery, notesKeys, notesQuery, noteSummaryQuery } from './queries'
import type { NotesApi } from './notesApi'

const api = {
  list: async (query: unknown) => ({ called: 'list', query }),
  get: async (id: string) => ({ called: 'get', id }),
  summary: async () => ({ called: 'summary' }),
} as unknown as NotesApi

describe('notes queries', () => {
  it('keys nest under one root so a single invalidation refreshes list, detail and summary', () => {
    expect(notesKeys.list({ q: 'a' })).toEqual(['notes', 'list', { q: 'a' }])
    expect(notesKeys.detail('n1')).toEqual(['notes', 'detail', 'n1'])
    expect(notesKeys.summary()).toEqual(['notes', 'summary'])
  })

  it('each query function calls the matching api method with the same arguments', async () => {
    await expect(notesQuery(api, { page: 1 }).queryFn()).resolves.toMatchObject({
      called: 'list',
      query: { page: 1 },
    })
    await expect(noteQuery(api, 'n1').queryFn()).resolves.toMatchObject({ called: 'get', id: 'n1' })
    await expect(noteSummaryQuery(api).queryFn()).resolves.toMatchObject({ called: 'summary' })
  })

  it('invalidateNotes marks every cached notes query stale but leaves other queries alone', async () => {
    const client = new QueryClient()
    client.setQueryData(notesKeys.list({}), 1)
    client.setQueryData(notesKeys.detail('n1'), 2)
    client.setQueryData(notesKeys.summary(), 3)
    client.setQueryData(['notifications', 'unread'], 4)
    await invalidateNotes(client)
    const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated
    expect(stale(notesKeys.list({}))).toBe(true)
    expect(stale(notesKeys.detail('n1'))).toBe(true)
    expect(stale(notesKeys.summary())).toBe(true)
    expect(stale(['notifications', 'unread'])).toBeFalsy()
  })
})
