import { onAccountChange } from '@skeleton/auth'
import {
  browserLocalStorage,
  forgetAuthorMemory,
  refreshProfilesOnAuthorRefusal,
} from '@skeleton/author-profile'
import { showApiError } from '@skeleton/ui'
import { refreshOnWorkspaceGone } from '@skeleton/workspace'
import { dropTeamNotes } from '../notes/queries'
import { authSession } from '../auth/session'
import { i18n } from '../i18n'
import { createQueryClient } from './createQueryClient'
import { refetchOnLanguageChange } from './refetchOnLanguage'
import { toastUnlessValidation } from './errorToast'

// 쿼리/뮤테이션 에러는 전부 토스트로 — 폼 검증 실패(400)만 칸 아래에 보이므로 뺀다
export const queryClient = createQueryClient({
  // 문구는 부를 때 `i18n.t` 로 채운다 — 그 시점의 화면 언어로 나온다(@skeleton/ui 는 번역을 모른다)
  onError: toastUnlessValidation((error) => {
    // 게시판이 작성자 id 를 거절했다(다른 탭에서 프로필을 지웠다) — 선택기가 낡은 목록을 그리지 않게 목록을 다시 받는다. 토스트는 그대로 뜬다
    refreshProfilesOnAuthorRefusal(queryClient, error)
    // 팀 요청이 404(추방 · 탈퇴 · 닫힘) - 풀어 둔 팀 · 내 팀 목록을 다시 묻고 그 팀 노트 캐시를 버린다: 낡은 멤버십을 그리지 않는다
    if (refreshOnWorkspaceGone(queryClient, error)) dropTeamNotes(queryClient)
    showApiError(error, {
      messages: {
        copy: i18n.t('common.copy'),
        traceIdCopied: i18n.t('error.traceCopied'),
        clickToCopy: i18n.t('error.clickToCopy'),
      },
    })
  }),
})

// 서버가 요청 언어로 고르는 이름(플랜 · 구독 · 카탈로그)은 언어를 바꾸면 다시 읽는다
refetchOnLanguageChange(i18n, queryClient)

// 로그인한 계정이 사라지거나 바뀔 때마다 — 로그아웃 버튼 · 다른 탭의 로그아웃 · 갱신 실패 · 401 · 다른 계정의 링크 로그인 — 서버 상태를 비운다.
// 다음 사람에게 이전 사람의 노트가 먼저 그려지지 않게. (버튼마다 `queryClient.clear()` 를 부르지 않는다 — 이 한 곳이 모든 길을 덮는다)
// 같은 자리에서 이 기기가 기억하는 「마지막으로 쓴 프로필」도 지운다 — 기기를 같이 쓰는 다음 사람에게 남기지 않는다(`mine` 도 호출자마다 달라 캐시와 함께 비워야 한다)
onAccountChange(authSession, () => {
  queryClient.clear()
  forgetAuthorMemory(browserLocalStorage())
})
