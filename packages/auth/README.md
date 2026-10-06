# @skeleton/auth

인증 조각 — 백엔드 `modules/auth` · `modules/auth-social` 계약을 그대로 부르고, 토큰을 들고, 라우트를 지킨다.
의존: `@skeleton/api-client` · `@skeleton/ui`(화면). peer: `react` `react-router-dom`.

```tsx
// 기본 저장소는 localStorage + crossTab(탭 사이 로그인 · 로그아웃 · 갱신 공유). 탭마다 따로면 sessionStorage, storage 생략 = 메모리만
const keys = authStorageKeys('my-app') // 저장 키 · 락 · 채널 이름을 앱 이름으로 나눈다(같은 출처의 앱끼리 토큰이 섞이지 않게)
const tokenStore = createTokenStore({ storage: window.localStorage, storageKey: keys.accessToken, crossTab: true })
const refreshStore = createRefreshStore({ storage: window.localStorage, storageKey: keys.refresh, crossTab: true })
const apiClient = createApiClient({
  ...,
  getAuthHeaders: createAuthHeadersProvider(tokenStore),
  onError: createUnauthorizedHandler({ store: tokenStore, refreshStore }), // 복구할 수 없는 401 → 두 저장소 삭제(+ onUnauthorized)
})
const authSession = createAuthSession({ api: createAuthApi(apiClient), store: tokenStore, refreshStore, refresher })
// 로그아웃 · 다른 탭의 로그아웃 · 갱신 실패 · 다른 계정의 링크 로그인 — 계정이 사라지거나 바뀔 때마다 서버 상태 캐시를 비운다
onAccountChange(authSession, () => queryClient.clear())

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
  // 로그인 방법: 둘 중 하나. 백엔드(GET /auth/methods)에 묻거나(discovery) 앱이 직접 정한다(methods — 이것이 이긴다)
  discovery: { delivery: 'body', social: { session: authSession, storage: window.sessionStorage } },
  // methods: { password: true, magicLink: true, social: [{ provider: 'google' }] },
  // socialFlow, socialLinkFlow,                       // methods 로 직접 정할 때만(createSocialLoginFlow · createSocialLinkFlow) — discovery 는 백엔드가 준 제공자로 만든다
  labels: koAuthLabels,                                // 기본 영어. 언어가 바뀌는 앱은 useLabels: () => 문구(훅)
  signUp: { consents: [...], renderCaptcha: ... },     // false 면 가입 · 메일 인증 라우트가 없다. 객체면 캡차 · 동의 슬롯
  forgotPassword: true, settings: { locales, sections: { delete: false } },
})
// routes: [{ element: <Layout />, children: [...accountRoutes, ...] }]
```

생기는 경로(`paths` 로 바꾼다): `/login` `/sign-up` `/verify-email` `/forgot-password` `/reset-password` `/magic-link`(방법이 켜졌을 때 — `discovery` 면 늘) `/auth/callback`(`socialFlow` 가 있거나 `discovery` 일 때) `/confirm-email-change` `/confirm-reauth`(비밀번호 없는 계정의 본인 확인 — 늘) · 로그인한 사람만 `/account` `/confirm-delete` `/account/link-callback`. 서버 렌더 앱은 `useApis`(요청마다 API) · `guard`(하이드레이션 안전판)를 쓴다 — SSR 스타터의 `src/auth/routes.tsx`.

**로그인 방법 — 백엔드가 알려 준다** — 기본은 `discovery`: 라우트가 `GET /auth/methods`(공개 · 캐시 가능 — 방법 · 가입 열림 · 소셜 제공자와 공개 clientId · 리프레시 전달 방식)를 물어 그대로 따른다. 모르는 동안(로딩)에는 로딩 화면 — 환경변수 기본값 같은 **틀린 방법이 깜박이지 않는다**(서버 렌더도 로딩 화면을 그리고 브라우저가 묻는다). 못 물으면(네트워크 · 옛 백엔드) `fallback`(기본 비밀번호만)과 「다시 시도」 줄. 답은 한 API 당 5분 공유(`loadAuthMethods`). 앱이 `methods` 를 직접 주면 그것이 이기고 묻지 않는다(환경변수 `VITE_AUTH_METHODS` 덮어쓰기 · `new-project.sh --auth-methods a,b` 로 고정). 소셜 버튼은 clientId 가 있는 제공자만(백엔드가 모르면 앱이 `VITE_SOCIAL_<제공자>_CLIENT_ID` 를 준다). 리프레시 전달 방식(`body` · `cookie`)은 시작할 때 정해야 하므로 앱 설정이고, 백엔드와 다르면 개발 콘솔에 경고한다(`deliveryMismatch`).

**다시 인증(비밀번호 없는 계정)** — 링크 · 소셜로만 가입한 계정이 이메일을 바꾸거나 첫 비밀번호를 정하거나 소셜을 연결하려면 서버가 `confirmationToken` 을 요구한다(없으면 403 `ACCOUNT.REAUTH_REQUIRED`, 틀리면 400 `ACCOUNT.REAUTH_FAILED`). 설정 화면이 시도 → 403 이면 하려던 작업을 탭의 `sessionStorage` 에 기억하고(`createReauthStore` — 새 비밀번호 같은 비밀은 저장하지 않는다) `POST /account/reauth/confirmation` 으로 메일을 보낸다. 링크(`/confirm-reauth?token=`)는 보통 **새 탭**에서 열리므로 도착 화면이 `BroadcastChannel` 로 같은 브라우저의 다른 탭에 토큰을 제안하고, 하려던 작업이 있는 탭이 받아 이어 간다(이메일 변경은 바로 마침 · 새 비밀번호는 한 번 더 입력). 답이 없으면(탭을 닫았다 · 다른 기기) 도착 화면이 토큰을 보관하고 설정에서 한 번 더 제출하라고 안내한다. 비밀번호가 있는 계정의 소셜 연결은 제공자에 다녀온 뒤 현재 비밀번호를 받는다(`SocialLinkPasswordScreen`).

**이메일 변경 대기** — `GET /account/me` 의 `pendingEmail` · `pendingEmailExpiresAt` 를 그대로 그린다(새로고침해도 남는다). 서버가 토큰 · 메일을 다른 스레드에서 만들어 요청 직후의 `me` 에는 아직 없으므로 몇 번 늦게 다시 읽는다(`reloadLater`). 취소 엔드포인트는 계약에 없다 — 「다시 보내기」 는 같은 폼을 다시 제출하는 것.

**토큰 갱신** — `createSessionRefresher` 를 클라이언트의 `recoverUnauthorized` 에 꽂는다: 401 → 갱신 한 번(동시에 여러 요청이 401 이어도 한 번, 다른 요청 · 탭이 이미 갱신했으면 호출 없이) → 같은 요청 한 번 재시도. 새 리프레시 토큰을 먼저 저장하고(옛 것은 두 번 보내지 않는다 — 재사용은 서버가 세션을 끊는다), 탭 사이는 `navigator.locks` + `storage` 이벤트(`crossTab`)로 맞춘다. `AUTH.REFRESH_INVALID` · `REFRESH_REUSED` · `ACCOUNT_SUSPENDED` 면 두 저장소를 비우고 `onSessionEnded(reason)`. 전달 방식 `body`(기본) | `cookie`(`createAuthApi(client, { delivery })` · `createApiClient({ withCredentials })` · 백엔드 `skeleton.auth-session.delivery`). 서버 렌더에서는 import 때 아무것도 읽지 않는다.

**로그아웃 · 계정 전환 때 서버 상태 비우기** — `onAccountChange(session, () => queryClient.clear())` 한 줄(앱의 `src/app/queryClient.ts`). 로그인한 계정이 사라지거나 바뀔 때마다(로그아웃 버튼 · 다른 탭의 로그아웃 · 갱신 실패 · 복구할 수 없는 401 · 링크 · 소셜로 다른 계정이 들어올 때) 불린다. 처음 로그인과 같은 계정의 토큰 갱신은 아니다. 쿼리 키에 계정이 없는 앱이 이전 사람의 데이터를 다음 사람에게 보이지 않게 한다.

**저장 키 이름공간** — 같은 출처에 앱 둘을 경로로 나눠 올려도 토큰 · 락 · 채널이 섞이지 않게 `authStorageKeys('my-app')` 로 키를 만든다(`<ns>.accessToken` · `.refresh` · `.auth.refresh`(락) · `.reauth.` · `.returnTo` · `.social.` · `.social-link.` · `.signUp` · 채널 `.reauth`). `createAuthRoutes({ namespace })` 에도 같은 이름을 준다. 생략하면 옛 이름 `skeleton`. 앱의 `AUTH_NAMESPACE` 는 `new-project.sh` 가 새 프로젝트 이름으로 찍는다.

**일회용 링크 도착 화면** — 이메일 인증 · 이메일 변경은 기본으로 「계속」 버튼을 눌러야 서버를 부른다(`requireConfirm`, JS 를 실행하는 메일 스캐너가 대신 확정하지 못하게). 링크 로그인은 도착하면 바로(계약이 마운트 POST 를 허용). 읽은 토큰 · OAuth 코드는 `history.replaceState` 로 주소창에서 지운다(`scrubUrlParams`). 앱 껍데기에는 `<meta name="referrer" content="no-referrer">` 를 둔다.

**다시 인증 보관소는 계정에 묶인다** — `reauthStore.forAccount(accountId)`: 다른 계정이 적은 하려던 작업 · 토큰은 읽히지 않고 버려진다. 로그아웃하면 비운다. 호출이 성공하기 전에는 토큰을 지우지 않는다(`peekToken` + `clearToken`). 본인 확인 토큰을 다른 탭에 넘기는 채널은 앱이 만들어 넘긴다(`createAuthRoutes({ reauthChannel: createBroadcastReauthChannel(keys.reauthChannel) })`) — 제안(offer) → 받겠다(claim) → 맡김(grant) 순이라 한 탭만 쓴다.

**인증번호(6자리) — FINAL-3 초안** — 가입 응답의 `signUpId` 로 같은 화면에서 코드를 받는다(`VerifyCodePanel` · `CodeEntry`). 맞으면 바로 로그인한다. 이메일 변경 · 다시 인증 · 삭제 확인의 코드 입력은 API(`confirmEmailChangeCode` · `confirmationCode` · `socialReauth` · `unlinkIdentity(id, reauth)`)만 준비돼 있고 화면은 옛 링크 방식이다.

**쿠키 모드 — 한 줄 스위치** — 앱의 `src/auth/authConfig.ts` 의 `DEFAULT_REFRESH_DELIVERY = 'body'` 를 `'cookie'` 로(또는 `.env` 에 `VITE_AUTH_REFRESH_DELIVERY=cookie`). 짝지을 백엔드 설정은 `skeleton.auth-session.delivery=cookie`(리프레시 토큰이 HttpOnly · Secure · `SameSite=Strict` 쿠키 `skeleton_refresh` 로만 오가 스크립트가 못 읽는다 — XSS 에 강하다). 조건: 프런트와 API 가 **같은 사이트**(개발은 Vite 프록시 · 배포는 같은 도메인의 리버스 프록시), 갱신 · 로그아웃은 `X-Requested-With: fetch` 와 자격 증명 포함으로 나간다(앱이 `withCredentials` 로 이미 건다). 기본은 `body` + `localStorage`(탭 여러 개 · 새로고침에서 로그인 유지, 대신 XSS 에 리프레시 토큰이 노출) — 어느 쪽이 맞는지는 위협 모델이 정한다. `cookieDelivery.test.ts` 가 이 길(CSRF 헤더 · 자격 증명 · 저장소에 토큰 없음 · 짝이 안 맞을 때 한 번만 실패)을 통합해서 지킨다.

**갱신 도중 페이지가 이동하면**(응답을 잃는다) — 백엔드 `reuse-grace`(샘플 · 스타터 백엔드는 `10s`, 멱등 회전: 직전 토큰을 유예 안에 다시 내밀면 같은 후속 토큰)가 있으면 다음 페이지의 갱신이 이어진다. 모듈 기본 `0s` 에서는 같은 일이 탈취로 보여 세션이 닫힌다 — 클라이언트는 `onSessionEnded('reuse-detected')` 로 한 번 깨끗이 로그아웃하고 멈춘다(루프 없음). 둘 다 `refreshNavigation.test.ts`.

**소셜 `state`** — 로그인 · 연결 모두 `start()` 가 만든 `state` 를 `sessionStorage`(그 탭)에 두고, 콜백은 `state` 가 없거나 이 브라우저가 시작한 것과 다르면 요청 없이 거절한다(`state_mismatch`). 같은 콜백을 두 번 처리해도 요청은 한 번. 반드시 `storage: window.sessionStorage` 를 넘긴다(생략하면 메모리라 제공자에 다녀오면 사라진다).

**선택 내보내기 `@skeleton/auth/admin`** — `AdminAccounts` · `AdminAccountsTable` · `createAdminAccountsApi`(백엔드 `skeleton.account.admin.enabled=true` + ADMIN). 쓰지 않으면 번들에 들어가지 않는다. 가드는 `RequireRole roles={['ADMIN']}`(역할 없음 = 로그아웃이 아니라 「접근 차단」 안내).

화면은 `Patterns/Auth/*` 스토리(로그인 · 가입 · 메일 링크 도착 · 계정 설정 · 운영자 표)가 정본이다. 문구는 모두 `labels` prop — 기본 영어, `koAuthLabels` 한국어, 그 밖의 언어는 `AuthLabels` 타입을 채운다(빠진 키는 컴파일 오류).

백엔드 계약(`docs/account-http-contract.md`)에서 이 패키지가 기대는 것: 응답 `AuthTokenResponse.{accessToken, refreshToken?, refreshExpiresAt?, sessionId?}` · 오류 코드 `AUTH.{EMAIL_NOT_VERIFIED, ACCOUNT_SUSPENDED, TOO_MANY_ATTEMPTS, REFRESH_INVALID, REFRESH_REUSED}` · `ACCOUNT.{TOKEN_INVALID(410), PASSWORD_POLICY(data.violations), CURRENT_PASSWORD_INVALID, REAUTH_FAILED, REAUTH_REQUIRED(403), EMAIL_TAKEN, SIGN_UP_CLOSED, CAPTCHA_FAILED, SOCIAL_EMAIL_CONFLICT, LAST_SIGN_IN_METHOD, RATE_LIMITED(data.retryAfterSeconds)}` · 정책 `GET /account/password/policy` 의 `maxBytes`(문서의 `maxLength` 도 받는다) · `Idempotency-Key`(이메일 변경 · 삭제) · 이메일 변경 확인은 이 기기도 로그아웃으로 다룬다(서버가 모든 세션을 닫는다) · 소셜 연결 해제 · 계정 삭제 뒤에는 세션 목록을 다시 읽는다(서버가 다른 세션을 닫는다) · 운영자 호출의 403 은 로그아웃이 아니라 「접근 차단」(저장된 계정이 더는 활성 관리자가 아니어도 토큰은 살아 있다) · 운영자 목록은 `size ≤ 100` · `page ≥ 0` 으로 맞춰 부른다.

## 공개 표면

| export                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 뜻                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `createSessionRefresher` · `createRefreshStore` · `createAccountApi` · `createAuthRoutes`                                                                                                                                                                                                                                                                                                                                                                   | 위 절                                                  |
| `SignInScreen` · `SignUpScreen` · `CheckEmailPanel` · `VerifyEmailScreen` · `MagicLinkLanding` · `ConfirmEmailChangeLanding` · `ConfirmReauthLanding` · `SocialLinkPasswordScreen` · `DiscoveryLoading` · `ForgotPasswordScreen` · `ResetPasswordScreen` · `SocialCallbackScreen` · `AccountStateNotice` · `AccountSettings`(+ `ProfileSection` · `PasswordSection` · `EmailSection` · `SignInMethodsSection` · `SessionsSection` · `DeleteAccountSection`) | 화면 · 절 — 문구 `labels`, 방법 `methods`              |
| `RequireRole` · `postSignInTarget` · `safeReturnPath` · `rememberReturnTo` · `consumeReturnTo`                                                                                                                                                                                                                                                                                                                                                              | 가드 · 로그인 뒤 돌아가기(같은 출처 경로만)            |
| `passwordRequirements` · `passwordStrength` · `violationsOf`                                                                                                                                                                                                                                                                                                                                                                                                | 서버 정책과 같은 규칙으로 힌트 · 강도 · 서버 위반 읽기 |
| `createSocialLinkFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                      | 로그인한 계정에 소셜 제공자 더하기                     |

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
