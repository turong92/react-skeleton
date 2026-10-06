import {
  createAuthRoutes,
  createSocialLinkFlow,
  createSocialLoginFlow,
  koAuthLabels,
} from '@skeleton/auth'
import {
  authMethodsOverride,
  refreshDelivery,
  socialClientIds,
  socialProviderConfigs,
} from './authConfig'
import { accountApi, authApi, authSession } from './session'

const origin = typeof window === 'undefined' ? '' : window.location.origin
const storage = typeof window === 'undefined' ? undefined : window.sessionStorage
const providers = socialProviderConfigs(import.meta.env, origin)
const hasSocial = authMethodsOverride !== undefined && Object.keys(providers).length > 0

// OAuth state 는 이 탭의 sessionStorage 에 묶는다 — 다른 브라우저 · 탭이 시작한 콜백은 거절된다
const socialFlow = hasSocial
  ? createSocialLoginFlow({ providers, session: authSession, storage })
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
      storage,
    })
  : undefined

/**
 * 계정 수명주기 라우트 한 벌(로그인 · 가입 · 메일 확인 · 비밀번호 재설정 · 링크 로그인 · 소셜 콜백 · 계정 설정).
 * 켜는 방법은 백엔드(`GET /auth/methods`)가 알려 준다 — `authConfig.ts` 의 환경변수 · 고정 목록이 덮어쓴다. 끄고 싶은 화면은 아래 옵션(`signUp: false` · `forgotPassword: false` · `settings.sections`).
 */
export const accountRoutes = createAuthRoutes({
  session: authSession,
  authApi,
  accountApi,
  methods: authMethodsOverride && {
    ...authMethodsOverride,
    social: (authMethodsOverride.social ?? []).filter((p) => providers[p.provider]),
  },
  discovery: {
    delivery: refreshDelivery,
    social: {
      session: authSession,
      storage,
      clientIds: socialClientIds(import.meta.env),
    },
  },
  socialFlow,
  socialLinkFlow,
  labels: koAuthLabels, // 영어로 쓰려면 이 줄을 지운다(기본 영어)
  settings: {
    locales: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
    ],
  },
})
