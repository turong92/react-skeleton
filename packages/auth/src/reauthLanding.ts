import { ApiRequestError } from '@skeleton/api-client'
import type { AccountApi } from './account/accountApi'
import type { ReauthStore } from './reauth'
import type { ReauthChannel } from './reauthChannel'

export type ReauthLandingOutcome =
  | { status: 'completed'; action: 'email-change' }
  /** 하려던 작업을 기억하는 다른 탭이 토큰을 받아 이어 간다 — 이 탭은 닫아도 된다 */
  | { status: 'handed-off' }
  /** 이 탭이 하려던 작업을 이어 갈 수 없다 — 토큰은 보관했고 다음 제출이 쓴다. `resume` 은 이 탭이 하던 작업(없으면 다른 탭 · 기기에서 연 링크) */
  | { status: 'stashed'; resume: 'set-password' | 'link-social' | null }
  | { status: 'failed'; error: unknown }

/**
 * `/confirm-reauth?token=` 도착 화면의 일 — 메일 링크의 토큰을 하려던 작업에 돌려준다.
 * 같은 탭에서 이메일 변경을 기다리고 있었다면 바로 마친다. 새 비밀번호 · 소셜 인가 코드처럼 저장하지 않은 비밀이 필요한 작업이거나
 * 다른 탭 · 기기에서 연 링크면 토큰을 보관하고(`ReauthStore`) 설정 화면에서 한 번 더 제출하게 한다.
 */
export async function resolveReauthLanding({
  token,
  store,
  accountApi,
  channel,
  handoffTimeoutMs = 800,
}: {
  token: string
  store: ReauthStore
  accountApi: Pick<AccountApi, 'changeEmail'>
  /** 있으면 이 탭이 모르는 작업의 토큰을 같은 브라우저의 다른 탭에 먼저 제안한다 */
  channel?: ReauthChannel | null
  handoffTimeoutMs?: number
}): Promise<ReauthLandingOutcome> {
  const pending = store.pending()
  if (pending?.kind === 'email-change') {
    try {
      await accountApi.changeEmail({ newEmail: pending.newEmail, confirmationToken: token })
      store.clearPending() // 마친 뒤에만 지운다
      return { status: 'completed', action: 'email-change' }
    } catch (error) {
      // 서버가 답해 거절했으면(4xx — 429 제외) 토큰은 낡았고 작업은 끝이다. 일시 오류(네트워크 · 5xx · 429)면 작업과 아직 쓰이지 않은 토큰을 둔다 — 다시 시도할 수 있다
      if (isDefinitive(error)) store.clearPending()
      else store.stashToken(token)
      return { status: 'failed', error }
    }
  }
  store.clearPending()
  if (!pending && channel && (await channel.offer(token, handoffTimeoutMs)))
    return { status: 'handed-off' }
  store.stashToken(token)
  return { status: 'stashed', resume: pending?.kind ?? null }
}

const isDefinitive = (error: unknown) =>
  error instanceof ApiRequestError &&
  error.apiError.status >= 400 &&
  error.apiError.status < 500 &&
  error.apiError.status !== 429
