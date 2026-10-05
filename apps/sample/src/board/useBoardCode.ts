import { useBoards } from '@skeleton/board'
import { boardApi } from './api'

/** 이 앱은 게시판 하나를 쓴다 — 서버가 알려 주는 목록의 첫 게시판(이름을 코드에 박지 않는다). 목록이 비면 `code` 는 undefined */
export function useBoardCode() {
  const boards = useBoards(boardApi)
  return { ...boards, code: boards.data?.[0]?.code, board: boards.data?.[0] }
}
