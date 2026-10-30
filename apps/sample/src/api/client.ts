import { chainForbiddenRecovery } from '@skeleton/api-client'
import { createAppApiClient } from './createAppApiClient'
import { refreshDelivery } from '../auth/authConfig'
import { refresher } from '../auth/refresher'
import { emailRequired } from './emailRequired'
import { loginIdRequired } from './loginIdRequired'
import { reconsent } from './reconsent'
import { refreshStore, tokenStore } from '../auth/tokenStore'
import { workspaceHeaders } from '../workspace/current'

const clientOptions = {
  env: import.meta.env,
  tokenStore,
  refreshStore,
  recoverUnauthorized: refresher.recover,
  // 막힌 403 은 사용자에게 물어 푼다 → 풀리면 같은 호출을 다시 보낸다. 순서는 서버와 같다: 아이디 정하기(ACCOUNT.LOGIN_ID_REQUIRED) → 이메일 등록(ACCOUNT.EMAIL_REQUIRED) → 약관 동의(LEGAL.RECONSENT_REQUIRED)
  recoverForbidden: chainForbiddenRecovery(
    loginIdRequired.recover,
    emailRequired.recover,
    reconsent.recover,
  ),
  withCredentials: refreshDelivery === 'cookie',
  debug: import.meta.env.DEV,
}

/** 앱 전역 API 클라이언트. 훅 · 페이지는 `apiClient.value<T>('/path')` 로 부른다. 팀 화면(`/w/<slug>/…`)에서는 요청마다 `X-Workspace-Id` 가 붙는다 — 서버가 멤버십을 검사한다(화면은 그냥 보낸다) */
export const apiClient = createAppApiClient({ ...clientOptions, extraHeaders: workspaceHeaders })

/** 워크스페이스 자기 관리(목록 · 풀기 · 멤버 · 초대 · 수락 · 운영)용 — 팀 헤더가 없다(경로에 id 가 있고, 추방 직후 남은 헤더가 목록을 막지 않게) */
export const workspaceClient = createAppApiClient(clientOptions)
