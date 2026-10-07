import {
  createAuthRoutes,
  createSocialLinkFlow,
  createSocialLoginFlow,
  type AuthPageName,
} from '@skeleton/auth'
import type { MessageKey } from '../i18n'
import type { SeoHandle } from '../seo/routeSeo'
import { serverClock } from '../api/serverClock'
import { accountApi, authApi, authSession } from './session'
import {
  authKeys,
  AUTH_NAMESPACE,
  authMethodsOverride,
  refreshDelivery,
  socialClientIds,
  socialProviderConfigs,
} from './authConfig'
import { queryClient } from '../app/queryClient'
import { refreshAfterProfileChange } from './profileCache'
import { ConsentSettingsSection } from '../legal/ConsentSettingsSection'
import { SignUpConsentsSlot } from '../legal/SignUpConsentsSlot'
import { useAuthLabels } from './useAuthLabels'

const browserStorage = () => (typeof window === 'undefined' ? undefined : window.sessionStorage)
const origin = typeof window === 'undefined' ? '' : window.location.origin
// 환경변수가 방법을 덮어쓸 때만 여기서 소셜 흐름을 만든다 — 아니면 백엔드가 알려 준 제공자로 라우트가 만든다(`discovery`)
const providers = socialProviderConfigs(import.meta.env, origin)
const hasSocial = authMethodsOverride !== undefined && Object.keys(providers).length > 0

// OAuth state 는 이 브라우저 탭의 sessionStorage 에 묶는다 — 제공자에 다녀와도 남고, 다른 브라우저 · 탭이 시작한 콜백은 거절된다
const socialFlow = hasSocial
  ? createSocialLoginFlow({
      providers,
      session: authSession,
      storage: browserStorage(),
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
      storage: browserStorage(),
      storagePrefix: authKeys.socialLink,
    })
  : undefined

/** 인증 화면은 모두 검색에서 뺀다(`noindex, nofollow`) — 제목 · 설명은 앱 사전의 키 */
const hidden = (page: AuthPageName): SeoHandle => ({
  seo: {
    titleKey: (page === 'account' ? 'nav.account' : 'login.title') as MessageKey,
    descriptionKey: 'seo.login.description' as MessageKey,
    indexable: false,
  },
})

/** 계정 수명주기 라우트 한 벌 — 켠 방법은 백엔드(`GET /auth/methods`)가 알려 주고, `authConfig.ts` 의 환경변수 · 고정 목록이 덮어쓸 수 있다 */
export const accountRoutes = createAuthRoutes({
  session: authSession,
  namespace: AUTH_NAMESPACE,
  // 인증번호 남은 시간은 서버 시각 기준(응답 Date 헤더로 보정한 시계)으로 센다
  now: () => serverClock.now().getTime(),
  authApi,
  accountApi,
  methods: authMethodsOverride && {
    ...authMethodsOverride,
    // clientId 가 없는 제공자는 버튼을 그리지 않는다
    social: (authMethodsOverride.social ?? []).filter((p) => providers[p.provider]),
  },
  discovery: {
    delivery: refreshDelivery,
    social: {
      session: authSession,
      storage: browserStorage(),
      clientIds: socialClientIds(import.meta.env),
    },
  },
  socialFlow,
  socialLinkFlow,
  useLabels: useAuthLabels,
  signInNotice: undefined,
  // 약관 동의 — 가입 폼의 체크박스(서버 문서) · 설정의 동의 이력 · 선택 동의 철회
  // 가입에서 닉네임을 필수로 받는다(`displayName: 'required'`) — 서버가 필수로 켜지 않은 환경에서도 게시판 작성자가 이름 없이 보이지 않게
  signUp: {
    displayName: 'required',
    renderConsents: (slot) => <SignUpConsentsSlot slot={slot} />,
  },
  settings: {
    // 서버(kotlin-skeleton `skeleton.account.deletion.self-restore`)가 켜져 있다 — 삭제 안내에 「다시 로그인하면 취소」를 말한다
    selfRestore: true,
    // 닉네임을 바꾸면 내 프로필(띠 · 게이트 · 인사말)과 게시판의 작성자 이름을 다시 읽는다
    onProfileChanged: () => refreshAfterProfileChange(queryClient),
    locales: [
      { value: 'ko', label: '한국어' },
      { value: 'en', label: 'English' },
    ],
    after: <ConsentSettingsSection />,
  },
  handle: hidden,
})
