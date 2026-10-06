import type { AccountApi } from './account/accountApi'
import { createSocialLoginFlow, type SocialLoginFlowOptions } from './social'
import type { AuthTokenResponse } from './types'

export type SocialLinkFlowOptions = Omit<SocialLoginFlowOptions, 'session'> & {
  accountApi: Pick<AccountApi, 'linkSocial'>
}

export type SocialLinkFlow = {
  start(provider: string): { url: string; state: string }
  /** 콜백을 확인하고 `POST /account/identities/social/{provider}` 로 보낸다 — 로그인 상태는 바뀌지 않는다 */
  complete(search: string | URLSearchParams): Promise<{ provider: string }>
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
  const flow = createSocialLoginFlow({
    ...rest,
    storagePrefix,
    session: {
      socialLogin: async (provider, authorizationCode, redirectUri) => {
        await accountApi.linkSocial(provider, authorizationCode, redirectUri)
        return { linked: provider } as unknown as AuthTokenResponse
      },
    },
  })
  return {
    start: flow.start,
    complete: async (search) => ({ provider: (await flow.complete(search)).provider }),
  }
}
