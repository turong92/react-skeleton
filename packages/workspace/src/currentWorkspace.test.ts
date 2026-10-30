import { describe, expect, it } from 'vitest'
import {
  createCurrentWorkspace,
  createWorkspaceHeaders,
  WORKSPACE_HEADER,
} from './currentWorkspace'

describe('createCurrentWorkspace + createWorkspaceHeaders', () => {
  it('sends X-Workspace-Id with the id the provider resolved', () => {
    const current = createCurrentWorkspace()
    const headers = createWorkspaceHeaders(current)
    current.set('ws_1')
    expect(headers()).toEqual({ 'X-Workspace-Id': 'ws_1' })
    expect(WORKSPACE_HEADER).toBe('X-Workspace-Id')
  })
  it('sends nothing when no workspace is resolved (the first screen, the team list)', () => {
    const current = createCurrentWorkspace()
    const headers = createWorkspaceHeaders(current)
    expect(headers()).toEqual({})
    current.set('ws_1')
    current.set(undefined)
    expect(headers()).toEqual({})
  })
  it('reads the id on every call (the header follows the tab, not the first request)', () => {
    const current = createCurrentWorkspace()
    const headers = createWorkspaceHeaders(current)
    current.set('ws_1')
    const first = headers()
    current.set('ws_2')
    expect([first, headers()]).toEqual([{ 'X-Workspace-Id': 'ws_1' }, { 'X-Workspace-Id': 'ws_2' }])
  })
  it('two stores do not share anything (one per request on a server, one per tab in a browser)', () => {
    const a = createCurrentWorkspace()
    const b = createCurrentWorkspace()
    a.set('ws_1')
    expect(b.get()).toBeUndefined()
  })
})
