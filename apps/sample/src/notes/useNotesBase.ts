import { useWorkspace } from '@skeleton/workspace'
import { teamPath } from '../workspace/paths'

/** 노트 화면의 주소 뿌리 — 팀 안(`/w/<slug>/…`)이면 `/w/<slug>/notes`, 아니면 내 노트 `/notes`. 같은 화면이 두 곳에 붙는다 */
export function useNotesBase(): string {
  const workspace = useWorkspace()
  return workspace ? teamPath(workspace.slug) : '/notes'
}
