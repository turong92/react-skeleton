# @skeleton/auth

인증 조각 — 백엔드 `modules/auth` · `modules/auth-social` 계약을 그대로 부르고, 토큰을 들고, 라우트를 지킨다.
의존: `@skeleton/api-client` · `@skeleton/ui`(화면). peer: `react` `react-router-dom`.

```tsx
const tokenStore = createTokenStore({ storage: window.sessionStorage }) // storage 생략 = 메모리만
const apiClient = createApiClient({
  ...,
  getAuthHeaders: createAuthHeadersProvider(tokenStore),
  onError: createUnauthorizedHandler({ store: tokenStore }), // 401 → 토큰 삭제(+ onUnauthorized)
})
const authSession = createAuthSession({ api: createAuthApi(apiClient), store: tokenStore })

<AuthProvider session={authSession}> … </AuthProvider>
{ element: <RequireAuth redirectTo="/login" />, children: [{ path: '/account', element: <Account /> }] }
const { status, principal, login, logout } = useAuth()
```

소셜 로그인 — 로그인 버튼과 콜백 페이지(`/auth/callback`)가 같은 `flow` 를 쓴다. 제공자 화면에 다녀오면 페이지가 새로 뜨므로 `state` 는 `sessionStorage` 에 둔다:

```tsx
const social = createSocialLoginFlow({
  session: authSession, // socialLogin(provider, code, redirectUri) 를 가진 것
  storage: window.sessionStorage,
  providers: { google: { clientId: '…', redirectUri: `${location.origin}/auth/callback` } },
})
window.location.assign(social.start('google').url) // 로그인 버튼
// 콜백 페이지: const result = useSocialLoginCallback(social, location.search) → 'pending' | 'success' | 'error'
```

`clientId` 는 공개값(authorize 주소에 실린다). `clientSecret` 은 백엔드 `skeleton.auth-social.providers.*` 에만 있다. 이 흐름은 백엔드 계약(`OAuthSocialLoginRequest`)까지만 안다 — scope 의 의미 · 계정 연결 정책(`LinkedAccountOnly…`)은 백엔드 설정이다.

## 계정 수명주기 — 라우트 한 벌

```tsx
import { createAuthRoutes, koAuthLabels } from '@skeleton/auth'

export const accountRoutes = createAuthRoutes({
  session: authSession, authApi, accountApi,          // createAuthApi · createAccountApi(apiClient)
  methods: { password: true, magicLink: true, social: [{ provider: 'google' }] }, // 켠 로그인 방법 — 화면 · 라우트가 이것만 따른다
  socialFlow, socialLinkFlow,                          // 소셜을 켤 때만(createSocialLoginFlow · createSocialLinkFlow)
  labels: koAuthLabels,                                // 기본 영어. 언어가 바뀌는 앱은 useLabels: () => 문구(훅)
  signUp: { consents: [...], renderCaptcha: ... },     // false 면 가입 · 메일 인증 라우트가 없다. 객체면 캡차 · 동의 슬롯
  forgotPassword: true, settings: { locales, sections: { delete: false } },
})
// routes: [{ element: <Layout />, children: [...accountRoutes, ...] }]
```

생기는 경로(`paths` 로 바꾼다): `/login` `/sign-up` `/verify-email` `/forgot-password` `/reset-password` `/magic-link`(방법이 켜졌을 때) `/auth/callback`(`socialFlow` 가 있을 때) `/confirm-email-change` · 로그인한 사람만 `/account` `/confirm-delete` `/account/link-callback`. 서버 렌더 앱은 `useApis`(요청마다 API) · `guard`(하이드레이션 안전판)를 쓴다 — SSR 스타터의 `src/auth/routes.tsx`.

**방법을 켜고 끄는 법** — `methods`(위) 한 곳. 앱 스타터는 환경변수 `VITE_AUTH_METHODS`(쉼표 목록, 기본 `password,magic-link`)와 `VITE_SOCIAL_<제공자>_CLIENT_ID` 를 `src/auth/authConfig.ts` 가 읽는다. 새 프로젝트의 기본값은 `new-project.sh --auth-methods password,google`. 백엔드의 같은 방법(모듈 · 설정)이 켜져 있어야 한다 — 백엔드가 열린 방법을 알려 주는 엔드포인트는 없다.

**토큰 갱신** — `createSessionRefresher` 를 클라이언트의 `recoverUnauthorized` 에 꽂는다: 401 → 갱신 한 번(동시에 여러 요청이 401 이어도 한 번, 다른 요청 · 탭이 이미 갱신했으면 호출 없이) → 같은 요청 한 번 재시도. 새 리프레시 토큰을 먼저 저장하고(옛 것은 두 번 보내지 않는다 — 재사용은 서버가 세션을 끊는다), 탭 사이는 `navigator.locks` + `storage` 이벤트(`crossTab`)로 맞춘다. `AUTH.REFRESH_INVALID` · `REFRESH_REUSED` · `ACCOUNT_SUSPENDED` 면 두 저장소를 비우고 `onSessionEnded(reason)`. 전달 방식 `body`(기본) | `cookie`(`createAuthApi(client, { delivery })` · `createApiClient({ withCredentials })` · 백엔드 `skeleton.auth-session.delivery`). 서버 렌더에서는 import 때 아무것도 읽지 않는다.

**소셜 `state`** — 로그인 · 연결 모두 `start()` 가 만든 `state` 를 `sessionStorage`(그 탭)에 두고, 콜백은 `state` 가 없거나 이 브라우저가 시작한 것과 다르면 요청 없이 거절한다(`state_mismatch`). 같은 콜백을 두 번 처리해도 요청은 한 번. 반드시 `storage: window.sessionStorage` 를 넘긴다(생략하면 메모리라 제공자에 다녀오면 사라진다).

**선택 내보내기 `@skeleton/auth/admin`** — `AdminAccounts` · `AdminAccountsTable` · `createAdminAccountsApi`(백엔드 `skeleton.account.admin.enabled=true` + ADMIN). 쓰지 않으면 번들에 들어가지 않는다. 가드는 `RequireRole roles={['ADMIN']}`(역할 없음 = 로그아웃이 아니라 「접근 차단」 안내).

화면은 `Patterns/Auth/*` 스토리(로그인 · 가입 · 메일 링크 도착 · 계정 설정 · 운영자 표)가 정본이다. 문구는 모두 `labels` prop — 기본 영어, `koAuthLabels` 한국어, 그 밖의 언어는 `AuthLabels` 타입을 채운다(빠진 키는 컴파일 오류).

백엔드 계약(`docs/account-http-contract.md`)에서 이 패키지가 기대는 것: 응답 `AuthTokenResponse.{accessToken, refreshToken?, refreshExpiresAt?, sessionId?}` · 오류 코드 `AUTH.{EMAIL_NOT_VERIFIED, ACCOUNT_SUSPENDED, TOO_MANY_ATTEMPTS, REFRESH_INVALID, REFRESH_REUSED}` · `ACCOUNT.{TOKEN_INVALID(410), PASSWORD_POLICY(data.violations), CURRENT_PASSWORD_INVALID, REAUTH_FAILED, EMAIL_TAKEN, SIGN_UP_CLOSED, CAPTCHA_FAILED, SOCIAL_EMAIL_CONFLICT, LAST_SIGN_IN_METHOD, RATE_LIMITED(data.retryAfterSeconds)}` · 정책 `GET /account/password/policy` 의 `maxBytes`(문서의 `maxLength` 도 받는다) · `Idempotency-Key`(이메일 변경 · 삭제) · 이메일 변경 확인은 이 기기도 로그아웃으로 다룬다.

## 공개 표면

| export                                                                                                                                                                                                                                                                                                                                                                           | 뜻                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `createSessionRefresher` · `createRefreshStore` · `createAccountApi` · `createAuthRoutes`                                                                                                                                                                                                                                                                                        | 위 절                                                  |
| `SignInScreen` · `SignUpScreen` · `CheckEmailPanel` · `VerifyEmailScreen` · `MagicLinkLanding` · `ConfirmEmailChangeLanding` · `ForgotPasswordScreen` · `ResetPasswordScreen` · `SocialCallbackScreen` · `AccountStateNotice` · `AccountSettings`(+ `ProfileSection` · `PasswordSection` · `EmailSection` · `SignInMethodsSection` · `SessionsSection` · `DeleteAccountSection`) | 화면 · 절 — 문구 `labels`, 방법 `methods`              |
| `RequireRole` · `postSignInTarget` · `safeReturnPath` · `rememberReturnTo` · `consumeReturnTo`                                                                                                                                                                                                                                                                                   | 가드 · 로그인 뒤 돌아가기(같은 출처 경로만)            |
| `passwordRequirements` · `passwordStrength` · `violationsOf`                                                                                                                                                                                                                                                                                                                     | 서버 정책과 같은 규칙으로 힌트 · 강도 · 서버 위반 읽기 |
| `createSocialLinkFlow`                                                                                                                                                                                                                                                                                                                                                           | 로그인한 계정에 소셜 제공자 더하기                     |

| export                                                                                                                                           | 뜻                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createTokenStore({ storage?, storageKey? })`                                                                                                    | `get/set/clear/subscribe`. 저장소가 막히거나 던져도 메모리로 동작                                                                                                                                                                                                                                                                                                                      |
| `createAuthApi(client)`                                                                                                                          | `login(PasswordLoginRequest)` → `POST /auth/login` · `me()` → `GET /auth/me` · `socialLogin(provider, authorizationCode, redirectUri?)` → `POST /auth/social/{provider}/login`                                                                                                                                                                                                         |
| `createAuthSession({ api, store })`                                                                                                              | 로그인 · 로그아웃 · `refresh()` + 상태 구독. React 없이 쓸 수 있다                                                                                                                                                                                                                                                                                                                     |
| `createAuthHeadersProvider(store)`                                                                                                               | api-client 의 `getAuthHeaders` 용                                                                                                                                                                                                                                                                                                                                                      |
| `createUnauthorizedHandler({ store, onUnauthorized?, ignoreCodes? })`                                                                            | api-client 의 `onError` 용 401 처리 지점(기본: `AUTH.INVALID_CREDENTIALS` 는 만료로 보지 않음)                                                                                                                                                                                                                                                                                         |
| `AuthProvider` · `useAuth()`                                                                                                                     | `{ status, token, principal, login, socialLogin, logout, refresh }`                                                                                                                                                                                                                                                                                                                    |
| `RequireAuth`                                                                                                                                    | 라우트 가드. 비로그인 → `redirectTo`(기본 `/login`), 돌아올 위치는 `location.state.from`. children 이 없으면 `<Outlet />`                                                                                                                                                                                                                                                              |
| `createSocialLoginFlow({ providers, session, storage? })` · `buildAuthorizeUrl` · `parseSocialCallback` · `useSocialLoginCallback(flow, search)` | 소셜 로그인의 프론트 절반. 백엔드는 `code` + `redirectUri` 만 받는다(`POST /auth/social/{provider}/login`) — authorize 주소 만들기(`google` · `kakao` · `naver` 프리셋, 그 밖은 `authorizeUrl`) · `state` 보관/검증(CSRF, 한 번만 쓰임) · 콜백 쿼리 읽기 · `socialLogin(provider, code, redirectUri)` 호출. 제공자 에러 · state 불일치 · code 없음은 `SocialLoginCallbackError.reason` |
| `devLoginHeaders` · `breakGlassHeaders` · `bearerAuthorization` · `requestAuthHeaders` · `applyAuthHeaders` · `parseDevIdentity`                 | dev-login(`X-Dev-*`) · break-glass(`X-Break-Glass-*`) 헤더. 개발 · 점검용                                                                                                                                                                                                                                                                                                              |
| `decodeTokenPrincipal(jwt)`                                                                                                                      | 서명 검증 없이 claim 읽기(화면 표시용)                                                                                                                                                                                                                                                                                                                                                 |
| 타입                                                                                                                                             | `AuthPrincipal` `AuthTokenResponse` `PasswordLoginRequest` `SocialLoginRequest` `DevLoginIdentity` `BreakGlassIdentity`                                                                                                                                                                                                                                                                |
