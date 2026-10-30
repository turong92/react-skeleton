import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { workspaceKeys } from './queries'
import { refreshOnWorkspaceGone } from './workspaceGone'

const refusal = (code: string, status = 404) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 'now' }, 't', 's', 'tp')

describe('refreshOnWorkspaceGone — a team request came back 404 (removed, left, closed): the screen must not keep the stale membership', () => {
  const setup = () => {
    const client = new QueryClient()
    client.setQueryData(workspaceKeys.bySlug('acme'), { id: 'ws_1' })
    client.setQueryData(workspaceKeys.list(), [])
    client.setQueryData(['other'], 1)
    return client
  }
  const stale = (client: QueryClient, key: readonly unknown[]) =>
    client.getQueryState(key)?.isInvalidated === true

  it('WORKSPACE.NOT_FOUND marks the resolved team and the list stale (the Provider asks again and shows "not found") and says it handled it', () => {
    const client = setup()
    expect(refreshOnWorkspaceGone(client, refusal(ErrorCodes.WORKSPACE_NOT_FOUND))).toBe(true)
    expect(stale(client, workspaceKeys.bySlug('acme'))).toBe(true)
    expect(stale(client, workspaceKeys.list())).toBe(true)
    expect(stale(client, ['other'])).toBe(false)
  })

  it('any other error leaves the caches alone', () => {
    const client = setup()
    expect(refreshOnWorkspaceGone(client, refusal(ErrorCodes.WORKSPACE_FORBIDDEN, 403))).toBe(false)
    expect(refreshOnWorkspaceGone(client, new Error('x'))).toBe(false)
    expect(stale(client, workspaceKeys.bySlug('acme'))).toBe(false)
  })
})
