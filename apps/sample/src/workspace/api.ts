import { createWorkspaceApi } from '@skeleton/workspace'
import { createWorkspaceAdminApi } from '@skeleton/workspace/admin'
import { workspaceClient } from '../api/client'

/** 워크스페이스 자기 관리 — 팀 헤더 없는 클라이언트(`api/client.ts`) */
export const workspaceApi = createWorkspaceApi(workspaceClient)
export const workspaceAdminApi = createWorkspaceAdminApi(workspaceClient)
