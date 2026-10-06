import { createLegalApi } from '@skeleton/legal'
import { apiClient } from './client'
import { bindLegalApi } from './reconsent'

/** 법적 문서 · 동의 API(`/api/v1/legal`) — 백엔드 `legal` 모듈이 열어 준다. 앱의 약관 화면 · 가입 동의 · 재동의 화면이 쓴다 */
export const legalApi = createLegalApi(apiClient)
bindLegalApi(legalApi)
