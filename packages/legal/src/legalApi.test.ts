import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createLegalApi } from './legalApi'

type Call = { kind: string; path: string; request?: ApiRequest }
function fakeClient(result: unknown = {}) {
  const calls: Call[] = []
  const record = (kind: string) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return result as never
  }
  return {
    calls,
    client: {
      value: record('value'),
      list: record('list'),
      page: record('page'),
      noContent: record('noContent'),
    },
  }
}

describe('createLegalApi (mirrors kotlin-skeleton docs/legal-http-contract.md)', () => {
  it('documents → GET /legal/documents, public (no sign-in header, cacheable)', async () => {
    const { client, calls } = fakeClient([])
    await createLegalApi(client).documents()
    expect(calls).toEqual([{ kind: 'list', path: '/legal/documents', request: { skipAuth: true } }])
  })

  it('document → GET /legal/documents/{type} with version and locale, public; the type is encoded', async () => {
    const { client, calls } = fakeClient({})
    const api = createLegalApi(client)
    await api.document('terms', { version: '2026-10-01', locale: 'ko' })
    await api.document('a b')
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/legal/documents/terms',
      request: { skipAuth: true, params: { version: '2026-10-01', locale: 'ko' } },
    })
    expect(calls[1].path).toBe('/legal/documents/a%20b')
    expect(calls[1].request?.params).toEqual({})
  })

  it('myConsents → GET /legal/consents/me with the sign-in', async () => {
    const { client, calls } = fakeClient({})
    await createLegalApi(client).myConsents()
    expect(calls).toEqual([{ kind: 'value', path: '/legal/consents/me', request: undefined }])
  })

  it('agree → POST /legal/consents with the items exactly as given and the source', async () => {
    const { client, calls } = fakeClient({})
    await createLegalApi(client).agree(
      [{ type: 'terms', version: '2026-10-01', locale: 'ko' }],
      're-consent',
    )
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/legal/consents',
      request: {
        method: 'POST',
        json: {
          consents: [{ type: 'terms', version: '2026-10-01', locale: 'ko' }],
          source: 're-consent',
        },
      },
    })
  })

  it('agree leaves the source out when none is given (the server defaults it)', async () => {
    const { client, calls } = fakeClient({})
    await createLegalApi(client).agree([{ type: 'marketing', version: 'v3' }])
    expect(calls[0].request?.json).toEqual({ consents: [{ type: 'marketing', version: 'v3' }] })
  })

  it('withdraw → POST /legal/consents/{type}/withdraw without a body', async () => {
    const { client, calls } = fakeClient({})
    await createLegalApi(client).withdraw('marketing')
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/legal/consents/marketing/withdraw',
      request: { method: 'POST' },
    })
  })

  it('history → GET /legal/consents/me/history as a page', async () => {
    const { client, calls } = fakeClient({ values: [] })
    await createLegalApi(client).history({ page: 2, size: 20 })
    expect(calls[0]).toEqual({
      kind: 'page',
      path: '/legal/consents/me/history',
      request: { params: { page: 2, size: 20 } },
    })
  })

  it('the base path is configurable (an app that serves the module elsewhere)', async () => {
    const { client, calls } = fakeClient([])
    await createLegalApi(client, { basePath: '/policies' }).documents()
    expect(calls[0].path).toBe('/policies/documents')
  })
})
