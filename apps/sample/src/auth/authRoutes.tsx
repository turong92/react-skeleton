import {
  createAuthRoutes,
  createSocialLinkFlow,
  createSocialLoginFlow,
  type AuthPageName,
} from '@skeleton/auth'
import type { MessageKey } from '../i18n'
import type { SeoHandle } from '../seo/routeSeo'
import { accountApi, authApi, authSession } from './session'
import { authMethods, socialProviderConfigs } from './authConfig'
import { useAuthLabels } from './useAuthLabels'

const browserStorage = () => (typeof window === 'undefined' ? undefined : window.sessionStorage)
const origin = typeof window === 'undefined' ? '' : window.location.origin
const providers = socialProviderConfigs(import.meta.env, origin)
const hasSocial = Object.keys(providers).length > 0

// OAuth state 는 이 브라우저 탭의 sessionStorage 에 묶는다 — 제공자에 다녀와도 남고, 다른 브라우저 · 탭이 시작한 콜백은 거절된다
const socialFlow = hasSocial
  ? createSocialLoginFlow({ providers, session: authSession, storage: browserStorage() })
  : undefined
const socialLinkFlow = hasSocial
  ? createSocialLinkFlow({
      providers: Object.fromEntries(
        Object.entries(providers).map(([name, config]) => [
          name,
          { ...config, redirectUri: `${origin}/account/link-callback` },
        ]),
      ),
      accountApi,
      storage: browserStorage(),
    })
  : undefined

/** 인증 화면은 모두 검색에서 뺀다(`noindex, nofollow`) — 제목 · 설명은 앱 사전의 키 */
const hidden = (page: AuthPageName): SeoHandle => ({
  seo: {
    titleKey: (page === 'account' || page === 'confirmDelete'
      ? 'nav.account'
      : 'login.title') as MessageKey,
    descriptionKey: 'seo.login.description' as MessageKey,
    indexable: false,
  },
})

/** 계정 수명주기 라우트 한 벌 — 켠 방법은 `authConfig.ts`(환경변수) 가 정한다 */
export const accountRoutes = createAuthRoutes({
  session: authSession,
  authApi,
  accountApi,
  methods: {
    ...authMethods,
    // clientId 가 없는 제공자는 버튼을 그리지 않는다
    social: (authMethods.social ?? []).filter((p) => providers[p.provider]),
  },
  socialFlow,
  socialLinkFlow,
  useLabels: useAuthLabels,
  signInNotice: undefined,
  settings: {
    locales: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
    ],
  },
  handle: hidden,
})
