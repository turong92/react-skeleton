import { createBoardApi } from '@skeleton/board'
import { apiClient } from '../api/client'

/** 게시판 — 경로는 백엔드 `modules/board` 가 여는 `/api/v1/boards` 가 기본값 */
export const boardApi = createBoardApi(apiClient)
