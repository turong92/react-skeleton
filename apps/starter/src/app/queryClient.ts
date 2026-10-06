import { onAccountChange } from '@skeleton/auth'
import { showApiError } from '@skeleton/ui'
import { authSession } from '../auth/session'
import { createQueryClient } from './createQueryClient'

// 쿼리/뮤테이션 에러는 전부 토스트로 — 문구를 바꾸려면 showApiError 의 messages 옵션
export const queryClient = createQueryClient({ onError: (error) => showApiError(error) })

// 로그인한 계정이 사라지거나 바뀔 때마다(로그아웃 · 다른 탭의 로그아웃 · 갱신 실패 · 401 · 다른 계정의 링크 로그인) 서버 상태를 비운다 —
// 다음 사람에게 이전 사람의 데이터가 먼저 그려지지 않게. 버튼마다 `queryClient.clear()` 를 부르지 않는다: 이 한 곳이 모든 길을 덮는다
onAccountChange(authSession, () => queryClient.clear())
