# @skeleton/auth

인증 조각 — 백엔드 `modules/auth` · `modules/auth-social` 계약을 그대로 부르고, 토큰을 들고, 라우트를 지킨다.
의존: `@skeleton/api-client`. peer: `react` `react-router-dom`.

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

## 공개 표면

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
