import { apiClient } from '../api/client'
import { createNotesApi } from './notesApi'

/** 앱 전역 노트 API — 훅(`queries.ts`)만 이것을 부른다 */
export const notesApi = createNotesApi(apiClient)
