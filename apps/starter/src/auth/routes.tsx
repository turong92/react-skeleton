import {
  createAuthRoutes,
  createSocialLinkFlow,
  createSocialLoginFlow,
  koAuthLabels,
} from '@skeleton/auth'
import {
  authKeys,
  AUTH_NAMESPACE,
  authMethodsOverride,
  refreshDelivery,
  socialClientIds,
  socialProviderConfigs,
} from './authConfig'
import { ConsentSettings, koLegalLabels } from '@skeleton/legal'
import { legalApi } from '../api/legal'
import { SignUpConsentsSlot } from '../legal/SignUpConsentsSlot'
import { accountApi, authApi, authSession } from './session'

const origin = typeof window === 'undefined' ? '' : window.location.origin
const storage = typeof window === 'undefined' ? undefined : window.sessionStorage
const providers = socialProviderConfigs(import.meta.env, origin)
const hasSocial = authMethodsOverride !== undefined && Object.keys(providers).length > 0

// OAuth state 는 이 탭의 sessionStorage 에 묶는다 — 다른 브라우저 · 탭이 시작한 콜백은 거절된다
const socialFlow = hasSocial
  ? createSocialLoginFlow({
      providers,
      session: authSession,
      storage,
      storagePrefix: authKeys.social,
    })
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
      storagePrefix: authKeys.socialLink,
    })
  : undefined

/**
 * 계정 수명주기 라우트 한 벌(로그인 · 가입(6자리 인증번호) · 비밀번호 재설정 · 링크 로그인 · 소셜 콜백 · 계정 설정).
 * 켜는 방법은 백엔드(`GET /auth/methods`)가 알려 준다 — `authConfig.ts` 의 환경변수 · 고정 목록이 덮어쓴다. 끄고 싶은 화면은 아래 옵션(`signUp: false` · `forgotPassword: false` · `settings.sections`).
 */
export const accountRoutes = createAuthRoutes({
  session: authSession,
  namespace: AUTH_NAMESPACE,
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
  // 약관 동의 — 가입 폼의 체크박스(서버 문서) · 설정의 동의 이력 · 선택 동의 철회. legal 모듈이 없는 백엔드면 둘 다 비어 있다(가입을 막지 않는다)
  signUp: { renderConsents: (slot) => <SignUpConsentsSlot slot={slot} /> },
  settings: {
    locales: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
    ],
    after: <ConsentSettings api={legalApi} locale="ko" labels={koLegalLabels} />,
  },
})
