import { createAuthApi, createAuthSession } from '@skeleton/auth'
import { apiClient } from '../api/client'
import { tokenStore } from './tokenStore'

/** 로그인 · 로그아웃 · 현재 사용자. 화면은 `useAuth()` 로 읽는다 */
export const authSession = createAuthSession({ api: createAuthApi(apiClient), store: tokenStore })
