import { describe, expect, it } from 'vitest'
import { recordingClient } from '../test/recordingClient'
import { createWorkspaceAdminApi } from './adminApi'

describe('createWorkspaceAdminApi (kotlin-skeleton modules/workspace, admin.enabled)', () => {
  it('list → GET /admin/workspaces with only the params given (cursor page)', async () => {
    const { client, calls } = recordingClient({ values: [], cursor: { hasNext: false } })
    const api = createWorkspaceAdminApi(client as never)
    await api.list()
    await api.list({ q: 'acme', cursor: 'c2', size: 20 })
    expect(calls).toEqual([
      { kind: 'cursor', path: '/admin/workspaces', request: { params: {} } },
      {
        kind: 'cursor',
        path: '/admin/workspaces',
        request: { params: { q: 'acme', cursor: 'c2', size: 20 } },
      },
    ])
  })

  it('get → GET /admin/workspaces/{id}, the id is path-encoded; reading only (no write call exists)', async () => {
    const { client, calls } = recordingClient()
    const api = createWorkspaceAdminApi(client as never, { basePath: '/ops/workspaces/' })
    await api.get('a/b')
    expect(calls).toEqual([{ kind: 'value', path: '/ops/workspaces/a%2Fb', request: undefined }])
    expect(Object.keys(api).sort()).toEqual(['get', 'list'])
  })
})
