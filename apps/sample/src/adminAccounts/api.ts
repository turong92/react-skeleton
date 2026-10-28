import { createAdminAccountsApi } from '@skeleton/auth/admin'
import { apiClient } from '../api/client'

/** 운영자 계정 호출 - 계정 화면 · 계정 한 건 화면 · 쿠폰 운영의 계정 찾기가 같이 쓴다 */
export const adminAccountsApi = createAdminAccountsApi(apiClient)
