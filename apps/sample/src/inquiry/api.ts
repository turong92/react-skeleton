import { createInquiryApi } from '@skeleton/inquiry'
import { apiClient } from '../api/client'

/** 문의 호출 - 백엔드 `inquiry` · `inquiry-jdbc` 가 여는 `/api/v1/inquiries`. 로그인 없이도 보내고, 로그인했으면 클라이언트가 토큰을 달아 계정이 붙는다 */
export const inquiryApi = createInquiryApi(apiClient)
