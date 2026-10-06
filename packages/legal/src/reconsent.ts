import { ApiRequestError, ErrorCodes, type ForbiddenContext } from '@skeleton/api-client'
import { DEFAULT_RECONSENT_EXCLUDED, isReconsentExcluded, missingFromError } from './consentLogic'
import type { LegalApi } from './legalApi'
import type { ConsentRequest, ConsentSource, MissingConsent } from './types'

/** 동의를 묻는 중인가 — `origin` 은 어디서 알았는가(`forbidden`: 호출이 403 을 받았다 · `sign-in`: 로그인 직후 `GET /consents/me` 가 blocked) */
export type ReconsentState =
  | { status: 'idle' }
  | {
      status: 'required'
      missing: MissingConsent[]
      origin: 'forbidden' | 'sign-in'
    }

export type ReconsentController = {
  getState(): ReconsentState
  subscribe(listener: () => void): () => void
  /** `createApiClient({ recoverForbidden })` 에 꽂는다 — 재동의 403 이면 화면을 열고 사용자가 동의(true) · 떠남(false)할 때까지 기다린다. 다른 403 · 제외 경로는 즉시 false */
  recover(context: ForbiddenContext): Promise<boolean>
  /** 로그인 직후 한 번 — `GET /consents/me` 가 blocked 면 화면을 연다(백엔드에 legal 모듈이 없거나 실패하면 조용히 넘어간다) */
  check(): Promise<void>
  /** `POST /consents` — 성공하면 기다리던 호출을 풀어 준다. 아직 막혀 있으면(그 사이 새 판) 새 목록으로 계속 묻는다. 409 `LEGAL.VERSION_STALE` 은 목록을 새로 읽고 다시 던진다 */
  agree(consents: ConsentRequest[], source?: ConsentSource): Promise<void>
  /** 사용자가 동의하지 않고 떠난다(로그아웃 등) — 기다리던 호출은 원래 403 으로 끝난다 */
  decline(): void
}

export type ReconsentOptions = {
  api: Pick<LegalApi, 'agree' | 'myConsents'>
  /** 서버가 막지 않는 경로의 접두어(기본 `/legal` · `/auth` · `/account`) — `legal` 의 basePath 를 바꿨다면 같이 바꾼다 */
  excludedPrefixes?: readonly string[]
}

const IDLE: ReconsentState = { status: 'idle' }

/**
 * 재동의의 상태 기계 — UI 가 없다(`ReconsentGate` 가 이 상태를 그린다). 같은 때에 실패한 호출들은 하나의 질문을 공유한다.
 * 403 은 로그아웃도 토큰 갱신도 아니다: 동의가 끝나면 막혔던 호출을 **그대로 한 번 더** 보낸다(api-client 의 `recoverForbidden`).
 */
export function createReconsentController({
  api,
  excludedPrefixes = DEFAULT_RECONSENT_EXCLUDED,
}: ReconsentOptions): ReconsentController {
  let state: ReconsentState = IDLE
  const listeners = new Set<() => void>()
  let waiters: Array<(value: boolean) => void> = []

  const set = (next: ReconsentState) => {
    state = next
    for (const listener of [...listeners]) listener()
  }
  const release = (value: boolean) => {
    const done = waiters
    waiters = []
    for (const resolve of done) resolve(value)
  }
  const open = (missing: MissingConsent[], origin: 'forbidden' | 'sign-in') => {
    // 이미 묻는 중이면 목록만 새로(같은 질문을 공유한다)
    set({
      status: 'required',
      missing,
      origin: state.status === 'required' ? state.origin : origin,
    })
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },

    async recover({ error, path }) {
      if (isReconsentExcluded(path, excludedPrefixes)) return false
      const missing = missingFromError(error)
      if (missing === null) return false
      open(missing, 'forbidden')
      return new Promise<boolean>((resolve) => waiters.push(resolve))
    },

    async check() {
      try {
        const mine = await api.myConsents()
        if (mine.blocked) open(mine.missing, 'sign-in')
      } catch {
        // legal 모듈이 없는 백엔드(404) · 네트워크 실패 — 이 검사는 서버 강제의 보조일 뿐이다(막히면 호출이 403 으로 말한다)
      }
    },

    async agree(consents, source) {
      const origin = state.status === 'required' ? state.origin : 'forbidden'
      try {
        const mine = await api.agree(
          consents,
          source ?? (origin === 'sign-in' ? 'first-sign-in' : 're-consent'),
        )
        if (mine.blocked) {
          open(mine.missing, origin)
          return
        }
        set(IDLE)
        release(true)
      } catch (error) {
        if (
          error instanceof ApiRequestError &&
          error.apiError.code === ErrorCodes.LEGAL_VERSION_STALE
        ) {
          try {
            const mine = await api.myConsents()
            if (mine.blocked) open(mine.missing, origin)
          } catch {
            // 목록을 못 새로 읽어도 화면은 오류를 보여 준다
          }
        }
        throw error
      }
    },

    decline() {
      set(IDLE)
      release(false)
    },
  }
}
