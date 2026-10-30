/** 요청에 싣는 지금 워크스페이스의 헤더 이름 — 서버는 이 헤더를 믿지 않고 요청마다 멤버십을 확인한다 */
export const WORKSPACE_HEADER = 'X-Workspace-Id'

/**
 * 「이 탭이 지금 어느 워크스페이스인가」를 React 밖(api 클라이언트의 `getAuthHeaders`)에 건네는 작은 칸.
 * 팀은 주소에서 읽으므로 탭마다 따로다 — 모듈 전역이 아니라 앱이 하나 만들어 `WorkspaceProvider` 와 `createWorkspaceHeaders` 에 같이 준다
 */
export type CurrentWorkspace = {
  get(): string | undefined
  set(id: string | undefined): void
}

export function createCurrentWorkspace(): CurrentWorkspace {
  let id: string | undefined
  return {
    get: () => id,
    set: (next) => {
      id = next
    },
  }
}

/** 앱의 `getAuthHeaders` 와 합칠 헤더 — 워크스페이스가 풀리기 전에는 아무것도 싣지 않는다 */
export function createWorkspaceHeaders(current: Pick<CurrentWorkspace, 'get'>) {
  return (): Record<string, string> => {
    const id = current.get()
    return id ? { [WORKSPACE_HEADER]: id } : {}
  }
}
