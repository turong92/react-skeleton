import { onAccountChange } from '@skeleton/auth'
import { showApiError } from '@skeleton/ui'
import { authSession } from '../auth/session'
import { i18n } from '../i18n'
import { createQueryClient } from './createQueryClient'
import { toastUnlessValidation } from './errorToast'

// 쿼리/뮤테이션 에러는 전부 토스트로 — 폼 검증 실패(400)만 칸 아래에 보이므로 뺀다
export const queryClient = createQueryClient({
  // 문구는 부를 때 `i18n.t` 로 채운다 — 그 시점의 화면 언어로 나온다(@skeleton/ui 는 번역을 모른다)
  onError: toastUnlessValidation((error) =>
    showApiError(error, {
      messages: {
        copy: i18n.t('common.copy'),
        traceIdCopied: i18n.t('error.traceCopied'),
        clickToCopy: i18n.t('error.clickToCopy'),
      },
    }),
  ),
})

// 로그인한 계정이 사라지거나 바뀔 때마다 — 로그아웃 버튼 · 다른 탭의 로그아웃 · 갱신 실패 · 401 · 다른 계정의 링크 로그인 — 서버 상태를 비운다.
// 다음 사람에게 이전 사람의 노트가 먼저 그려지지 않게. (버튼마다 `queryClient.clear()` 를 부르지 않는다 — 이 한 곳이 모든 길을 덮는다)
onAccountChange(authSession, () => queryClient.clear())
