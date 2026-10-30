import {
  createCurrentWorkspace,
  createLastWorkspaceMemory,
  createWorkspaceHeaders,
  browserLocalStorage,
} from '@skeleton/workspace'

/** 이 탭의 「지금 팀」 칸 — `WorkspaceProvider` 가 주소의 slug 를 풀어 채우고, 앱 api 클라이언트가 `X-Workspace-Id` 로 싣는다. 탭마다 따로다(모듈은 탭마다 한 번 불린다) */
export const currentWorkspace = createCurrentWorkspace()
export const workspaceHeaders = createWorkspaceHeaders(currentWorkspace)

/** 「마지막에 쓴 팀」 — 첫 화면(`/workspaces`)이 어디로 보낼지 정할 때만 읽는다. 주소에 팀이 있으면 읽지 않는다 */
export const lastWorkspaceMemoryFor = (accountId: string) =>
  createLastWorkspaceMemory(browserLocalStorage(), accountId)
