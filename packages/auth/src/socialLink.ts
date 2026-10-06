import type { AccountApi, ReauthCredential } from './account/accountApi'
import { createSocialLoginFlow, type SocialLoginFlowOptions } from './social'
import type { AuthTokenResponse } from './types'

export type SocialLinkFlowOptions = Omit<SocialLoginFlowOptions, 'session'> & {
  accountApi: Pick<AccountApi, 'linkSocial'>
}

/** 제공자 동의 왕복이 끝난 뒤 이어 갈 작업 — 폼이 다시 그릴 수 있는 것만 담는다(비밀 없음. `link-reauth` 의 `target` 만 아직 쓰이지 않은 인가 코드를 싣는다) */
export type ProviderAction =
  | { kind: 'email-change'; newEmail: string }
  | { kind: 'unlink'; identityId: string }
  | { kind: 'delete' }
  /** 이 동의가 **연결할** 제공자의 것이다(비밀번호 · 코드로 다시 인증하는 계정) */
  | { kind: 'link' }
  /** 이 동의는 이미 연결된 제공자의 **다시 인증**이고, 연결하려던 제공자의 코드는 `target` 에 있다 */
  | { kind: 'link-reauth'; target: SocialLinkCallbackBase }

/** state 에 묶여 돌아오는 값 — 어느 계정이 무슨 작업을 하려던 왕복인지 */
export type SocialLinkContext = { accountId: string; action: ProviderAction }

type SocialLinkCallbackBase = { provider: string; authorizationCode: string; redirectUri?: string }

/** 콜백이 돌려준, 서버로 보낼 값 — state 는 이미 확인했다. `context` 는 `start` 때 묶은 값 */
export type SocialLinkCallback = SocialLinkCallbackBase & { context?: SocialLinkContext }

export type SocialLinkFlow = {
  /** `context` 는 그 state 에 묶여 `read` 결과로 돌아온다(어느 계정의 무슨 작업인지) */
  start(provider: string, context?: SocialLinkContext): { url: string; state: string }
  /** 콜백의 state · 에러 · code 를 확인하고 **서버를 부르지 않은 채** 값을 돌려준다 — 화면이 비밀번호를 먼저 받을 때. 같은 콜백을 두 번 읽어도 같은 결과 */
  read(search: string | URLSearchParams): Promise<SocialLinkCallback>
  /** `read` 한 뒤 `POST /account/identities/social/{provider}` — 로그인 상태는 바뀌지 않는다. 다시 인증(`currentPassword` · `confirmationCode` · `socialReauth`)은 서버가 강제한다 */
  complete(
    search: string | URLSearchParams,
    reauth?: ReauthCredential,
  ): Promise<{ provider: string }>
}

/**
 * 로그인한 사람이 소셜 제공자를 **계정에 더하는** 흐름. 인가 주소 · state 검증은 로그인 흐름과 같고(`createSocialLoginFlow`),
 * code 를 받는 곳만 `identities/social` 이다. 저장 키 접두어가 달라 로그인 흐름과 섞이지 않는다.
 * 제공자 콘솔에는 로그인용과 다른 콜백 주소(예 `/account/link-callback`)를 등록하는 것이 안전하다.
 */
export function createSocialLinkFlow({
  accountApi,
  storagePrefix = 'skeleton.social-link.',
  ...rest
}: SocialLinkFlowOptions): SocialLinkFlow {
  // 로그인 흐름의 state 검증을 그대로 쓰되, 서버 호출 자리에는 값을 모으기만 한다
  const flow = createSocialLoginFlow({
    ...rest,
    storagePrefix,
    session: {
      socialLogin: async (provider, authorizationCode, redirectUri) =>
        ({ provider, authorizationCode, redirectUri }) as unknown as AuthTokenResponse,
    },
  })
  const read: SocialLinkFlow['read'] = async (search) => {
    const { token, context } = await flow.complete(search)
    return {
      ...(token as unknown as SocialLinkCallbackBase),
      ...(context ? { context } : {}),
    } as SocialLinkCallback
  }
  const linked = new Map<string, Promise<{ provider: string }>>()
  return {
    start: flow.start,
    read,
    complete(search, reauth) {
      const state = new URLSearchParams(search).get('state') ?? ''
      const known = linked.get(state)
      if (known) return known
      const run = read(search).then(async ({ provider, authorizationCode, redirectUri }) => {
        await (reauth
          ? accountApi.linkSocial(provider, authorizationCode, redirectUri, reauth)
          : accountApi.linkSocial(provider, authorizationCode, redirectUri))
        return { provider }
      })
      if (state) linked.set(state, run)
      return run
    },
  }
}
