import { createContext, useContext } from 'react'
import type { WorkspaceDetail } from './types'

export const WorkspaceContext = createContext<WorkspaceDetail | null>(null)

/**
 * 지금 워크스페이스 — `WorkspaceProvider` 안에서는 주소의 slug 가 풀린 상세(id · 이름 · 지금 slug · 내 역할 …),
 * 밖(첫 화면 · 팀 목록)에서는 null. Provider 는 풀린 뒤에만 자식을 그리므로 안쪽에서는 늘 값이 있다
 */
export const useWorkspace = (): WorkspaceDetail | null => useContext(WorkspaceContext)
