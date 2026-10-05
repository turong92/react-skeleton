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

## 공개 표면

| export                                                                                                                           | 뜻                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createTokenStore({ storage?, storageKey? })`                                                                                    | `get/set/clear/subscribe`. 저장소가 막히거나 던져도 메모리로 동작                                                                                                              |
| `createAuthApi(client)`                                                                                                          | `login(PasswordLoginRequest)` → `POST /auth/login` · `me()` → `GET /auth/me` · `socialLogin(provider, authorizationCode, redirectUri?)` → `POST /auth/social/{provider}/login` |
| `createAuthSession({ api, store })`                                                                                              | 로그인 · 로그아웃 · `refresh()` + 상태 구독. React 없이 쓸 수 있다                                                                                                             |
| `createAuthHeadersProvider(store)`                                                                                               | api-client 의 `getAuthHeaders` 용                                                                                                                                              |
| `createUnauthorizedHandler({ store, onUnauthorized?, ignoreCodes? })`                                                            | api-client 의 `onError` 용 401 처리 지점(기본: `AUTH.INVALID_CREDENTIALS` 는 만료로 보지 않음)                                                                                 |
| `AuthProvider` · `useAuth()`                                                                                                     | `{ status, token, principal, login, socialLogin, logout, refresh }`                                                                                                            |
| `RequireAuth`                                                                                                                    | 라우트 가드. 비로그인 → `redirectTo`(기본 `/login`), 돌아올 위치는 `location.state.from`. children 이 없으면 `<Outlet />`                                                      |
| `devLoginHeaders` · `breakGlassHeaders` · `bearerAuthorization` · `requestAuthHeaders` · `applyAuthHeaders` · `parseDevIdentity` | dev-login(`X-Dev-*`) · break-glass(`X-Break-Glass-*`) 헤더. 개발 · 점검용                                                                                                      |
| `decodeTokenPrincipal(jwt)`                                                                                                      | 서명 검증 없이 claim 읽기(화면 표시용)                                                                                                                                         |
| 타입                                                                                                                             | `AuthPrincipal` `AuthTokenResponse` `PasswordLoginRequest` `SocialLoginRequest` `DevLoginIdentity` `BreakGlassIdentity`                                                        |
