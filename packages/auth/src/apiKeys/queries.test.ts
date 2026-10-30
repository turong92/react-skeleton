import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { createApiKeyOptions } from './queries'

describe('createApiKeyOptions', () => {
  it('leaves neither the token nor the re-auth password in the mutation cache once the dialog lets go', async () => {
    const client = new QueryClient()
    const api = {
      create: async () => ({
        key: { id: 'k1' } as never,
        token: 'notes_SECRET_TOKEN',
      }),
    }
    const observer = new MutationObserver(client, createApiKeyOptions(api, client))
    await observer.mutate({ name: 'ci', scopes: ['notes.read'], currentPassword: 'hunter2' })
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((m) => m.state),
      ),
    ).toContain('notes_SECRET_TOKEN')
    observer.reset() // 대화상자를 닫는다
    await new Promise((done) => setTimeout(done, 10))
    expect(client.getMutationCache().getAll()).toHaveLength(0)
  })
})
