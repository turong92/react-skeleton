import { createSearchApi } from '@skeleton/search'
import { apiClient } from '../api/client'

/** 검색 호출 - 백엔드 `search` · `search-jdbc` 가 여는 `/api/v1/search`. 로그인한 사람만 묻는다(서버 `allow-anonymous-read` 는 꺼짐) */
export const searchApi = createSearchApi(apiClient)
