# @skeleton/auth

인증 조각 — 백엔드 `modules/auth` · `modules/auth-social`(+ 제공자 모듈 google · kakao · naver · oidc(LINE) · x) 계약을 그대로 부르고, 토큰을 들고, 라우트를 지킨다.
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
  providers: discovered.providers, // GET /auth/methods → methodsFromInfo(info).providers — authorize 주소 · scope · pkce · nonce 가 들어 있다
})
const { url } = await social.start('line') // 비동기(WebCrypto SHA-256) — PKCE 필수인데 WebCrypto 가 없으면 PkceUnavailableError
window.location.assign(url) // 로그인 버튼
// 콜백 페이지: const result = useSocialLoginCallback(social, location.search) → 'pending' | 'success' | 'error'
```

제공자 목록 · 순서 · authorize 주소 · scope · `pkce`/`nonce` 요구는 모두 백엔드의 `GET /auth/methods` 가 말해 준다(`createAuthRoutes({ discovery })` 가 알아서 쓴다) — 프런트에는 제공자 주소가 없다(authorize 정보를 안 보내는 옛 백엔드용 `SOCIAL_AUTHORIZE_PRESETS` 는 **LEGACY** 대체 표). 버튼의 마크 · 문구는 제공자 코드로 붙는다(`providerPresentation` — google · line · x · kakao · naver, 모르는 코드는 중립 마크; 문구는 `labels.providerSignInText` / `signInWithProvider`). `clientId` 는 공개값(authorize 주소에 실린다). `clientSecret` 은 백엔드 `skeleton.auth-social.providers.*` 에만 있다. 이 흐름은 백엔드 계약(`OAuthSocialLoginRequest`)까지만 안다 — scope 의 의미 · 계정 연결 정책(`LinkedAccountOnly…`)은 백엔드 설정이다.

## 실제 제공자 붙일 때 (Google · LINE · X)

**1. 콜백 주소를 제공자 콘솔에 글자 그대로 등록한다.** 이 앱이 내놓는 주소는 둘이다 — 로그인용과 (설정에서 하는) 연결 · 다시 인증용. 제공자는 `redirect_uri` 를 **정확히** 비교한다(http/https · 호스트 · 포트 · 끝 슬래시 하나만 달라도 `redirect_uri_mismatch`).

| 쓰임                                                                              | 로컬(Vite 기본 포트)                                                                               | 배포                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 로그인 · 가입 (`/auth/callback`)                                                  | `http://localhost:5173/auth/callback` · X 는 `http://127.0.0.1:5173/auth/callback`                 | `https://<도메인>/auth/callback`         |
| 계정 연결 · 이메일 변경 · 연결 해제 · 삭제의 다시 인증 (`/account/link-callback`) | `http://localhost:5173/account/link-callback` · X 는 `http://127.0.0.1:5173/account/link-callback` | `https://<도메인>/account/link-callback` |

- **X 는 `localhost` 를 거부한다** — 개발 서버를 `127.0.0.1` 로 열고(`vite --host 127.0.0.1`) 그 주소로 등록 · 접속한다. LINE 이 http `localhost` 를 허용하는지는 콘솔에서 확인(안 되면 https 터널 주소).
- 두 주소를 **모두** 등록한다(Google 은 여러 개 가능 · LINE 은 Callback URL 칸에 여러 줄 · X 는 Callback URI 여러 개). 로그인 요청의 `redirectUri` 는 그 인가 요청에 쓴 값과 같아야 하므로 이 패키지가 시작 때 저장한 값을 그대로 보낸다.
- 백엔드가 `redirectUri` 를 알려 주면(`skeleton.auth-social*.providers.*.redirect-uri`) 그 값이 이긴다 — 이 앱의 콜백과 **출처 · 경로 · 끝 슬래시**가 다르면 개발 콘솔에 어디가 다른지 경고한다(`redirectUriProblems`). 백엔드 값은 보통 비워 두고 앱이 자기 출처로 만든다.
- 시작한 탭에서 끝내야 한다(`state` · verifier · nonce 는 그 탭의 `sessionStorage`). 모바일에서 LINE 앱 · 인앱 브라우저가 콜백을 **다른 브라우저/탭**으로 열면 「이 탭에서 시작한 로그인이 아니에요」 안내가 뜬다 — 같은 브라우저에서 다시 시작한다.
- **인가 코드 수명**: LINE 10분 · **X 30초** · 그 밖은 비공개 — 콜백을 받으면 바로 백엔드로 보낸다(이 패키지는 `complete` 안에서 곧바로). 같은 코드를 두 번 쓰지 않는다(StrictMode 이중 실행도 로그인은 한 번).
- 제공자가 이메일을 안 주거나 믿을 수 없다고 하면(LINE · X) 주소 없는 계정이 된다 — 설정은 「주소 없음」으로 그리고 「이메일 추가」는 LINE/X 동의를 다시 거친다(새 `state` · verifier · nonce).

백엔드 쪽 콘솔 설정(Channel ID · secret · 이메일 권한 · 테스터 등록)은 kotlin-skeleton 의 `docs/modules/auth-social-oidc.md` · `auth-social-x.md` 체크리스트를 따른다.

## PKCE · nonce — 시도마다

시작할 때마다 `state`(24바이트) · `codeVerifier`(32바이트 → 43자 base64url) · `nonce`(제공자가 쓸 때)를 CSPRNG 로 만들어 탭 `sessionStorage` 의 `state` 키 아래에 **제공자 · 종류(login · link · reauth) · 계정**과 함께 둔다 — 한 번 읽으면 지워진다. `code_challenge = BASE64URL(SHA-256(verifier))`(S256 뿐) 만 URL 에 간다. 로그인 · 연결(최상위) · `socialReauth`(이메일 변경 · 연결 해제 · 삭제)에 `codeVerifier` · `nonce` 를 싣는다. `pkce: UNSUPPORTED` 제공자에는 PKCE 파라미터를 보내지 않는다(모르는 파라미터를 거절하는 곳이 있다). 400 `AUTH.SOCIAL_PKCE_FAILED` · `AUTH.SOCIAL_NONCE_FAILED` 는 요청이 잘못 만들어진 것(아직 아무것도 쓰이지 않았다), 401 `AUTH_SOCIAL.INVALID_AUTHORIZATION_CODE` · `AUTH.SOCIAL_ID_TOKEN_INVALID` 는 동의를 처음부터 다시.

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
  signUp: { consents: [...], renderCaptcha: ... },     // false 면 가입 라우트가 없다. 객체면 캡차 · 동의 슬롯
  forgotPassword: true, settings: { locales, sections: { delete: false } },
})
// routes: [{ element: <Layout />, children: [...accountRoutes, ...] }]
```

생기는 경로(`paths` 로 바꾼다): `/login` `/sign-up` `/forgot-password` `/reset-password` `/magic-link`(방법이 켜졌을 때 — `discovery` 면 늘) `/auth/callback`(`socialFlow` 가 있거나 `discovery` 일 때) · 로그인한 사람만 `/account` `/account/link-callback`. **링크가 남은 곳은 비밀번호 재설정과 링크 로그인뿐**(그 흐름에는 세션이 없다). 가입 인증 · 이메일 변경 · 다시 인증 · 삭제 확인은 6자리 인증번호를 그 자리에서 입력한다. 오래된 메일의 링크(`/verify-email` `/confirm-email-change` `/confirm-reauth` `/confirm-delete` — `legacyLinks` 로 바꾸거나 `false`)는 토큰을 읽지 않고 「이 링크는 더 이상 쓰이지 않아요」 한 장으로 보낸다. 서버 렌더 앱은 `useApis`(요청마다 API) · `guard`(하이드레이션 안전판)를 쓴다 — SSR 스타터의 `src/auth/routes.tsx`.

**로그인 방법 — 백엔드가 알려 준다** — 기본은 `discovery`: 라우트가 `GET /auth/methods`(공개 · 캐시 가능 — 방법 · 가입 열림 · 소셜 제공자와 공개 clientId · 리프레시 전달 방식)를 물어 그대로 따른다. 모르는 동안(로딩)에는 로딩 화면 — 환경변수 기본값 같은 **틀린 방법이 깜박이지 않는다**(서버 렌더도 로딩 화면을 그리고 브라우저가 묻는다). 못 물으면(네트워크 · 옛 백엔드) `fallback`(기본 비밀번호만)과 「다시 시도」 줄. 답은 한 API 당 5분 공유(`loadAuthMethods`). 앱이 `methods` 를 직접 주면 그것이 이기고 묻지 않는다(환경변수 `VITE_AUTH_METHODS` 덮어쓰기 · `new-project.sh --auth-methods a,b` 로 고정). 소셜 버튼은 clientId 가 있는 제공자만(백엔드가 모르면 앱이 `VITE_SOCIAL_<제공자>_CLIENT_ID` 를 준다). 리프레시 전달 방식(`body` · `cookie`)은 시작할 때 정해야 하므로 앱 설정이고, 백엔드와 다르면 개발 콘솔에 경고한다(`deliveryMismatch`).

**가입 = 인증번호** — `POST /account/sign-up` 은 계정을 만들지 않고 `202 {status, signUpId}` 만 준다(주소가 새것이든 이미 있든 같은 모양). 메일의 6자리를 같은 화면에서 입력하면(`VerifyCodePanel` · `CodeEntry`, 6자리를 채우면 버튼 없이 제출) `POST /auth/verify-email {signUpId, code}` 가 계정을 만들고 **바로 로그인**시킨다(응답이 토큰, `X-Device-Name` 도 실린다). 틀리면 `ACCOUNT.CODE_INVALID` + 남은 횟수(`data.attemptsLeft`)를 보이고 칸을 비운다. 만료 · 소진 · 이미 씀은 `ACCOUNT.CODE_EXPIRED`(410, 한 가지 응답) → 처음부터. 「새 코드」는 `POST /account/verification/resend {signUpId}`(30초 쿨다운). 진행 중인 시도(`signUpId` + 주소 — 비밀번호는 아니다)는 그 탭의 `sessionStorage` 에 둬 코드 단계에서 새로고침해도 이어진다. 메일 인증을 끈 백엔드는 `201 CREATED`(signUpId 없음)라 바로 로그인 화면으로 간다.

**인증번호 남은 시간** — 모든 코드 단계(가입 · 이메일 변경 · 다시 인증 · 삭제 확인)가 `CodeEntry` 의 `mm:ss` 를 보인다. 만료 시각은 절대 시각이고 시계는 `createAuthRoutes({ now })`(서버 `Date` 헤더로 보정한 `serverClock`). 출처: 이메일 변경 = 서버 `me.pendingEmailExpiresAt`, 가입 · 재인증 · 삭제 = 서버가 시각을 안 줘서 **어림**(`codeTtlSeconds`: 600 · 1800, `data-expiry-source="estimate"`). 백엔드가 응답에 `expiresAt` · `resendAvailableAt`(ISO-8601)을 주면 자동으로 그 값을 쓴다(`codeWindowOf`). 가입 보관 상태에는 시각만(코드 · 비밀번호 없음).

**다시 인증 — 계정에 맞는 하나** — 이메일 변경 · 첫 비밀번호 · 소셜 연결 · 연결 해제 · 계정 삭제는 서버가 다시 인증을 강제한다. 화면은 `me` 로 종류를 고른다(`reauthKindOf`): **비밀번호**가 있으면 현재 비밀번호 · 없고 주소가 있으면 **메일로 받은 6자리**(`POST /account/reauth/confirmation` — 계정 + 이 세션에 묶임 · 30분 · 5번, 삭제는 별도의 `delete/confirmation`) 를 같은 자리에서 입력(`ReauthProof` 안의 `CodeEntry` — 서버 검증은 작업 요청이 한다: 틀리면 남은 횟수, 만료면 새로 받기) · 주소도 없으면(Naver 등) 이미 연결된 **제공자로 동의를 다시** 거친다(`socialReauth {provider, authorizationCode, redirectUri?}`). 제공자 왕복은 `createSocialLinkFlow().start(provider, { accountId, action })` — 하려던 작업과 계정이 OAuth `state` 기록에 묶여 있어(한 번 읽으면 지워진다 · 같은 콜백을 두 번 읽어도 같은 결과 → StrictMode 안전) 다른 계정이 시작한 왕복은 이어 가지 않는다. 돌아오면 `/account/link-callback` 이 새 인가 코드를 들고 설정 화면으로 돌아가 하려던 작업(이메일 변경 · 해제 · 삭제)을 **한 번만** 이어서 한다. 소셜 연결은 제공자에 다녀온 **뒤** 증거를 받고(서버가 제공자 코드를 바꾸기 전에 증거를 보므로 틀려도 같은 코드로 다시), 주소 없는 계정의 연결은 연결할 제공자의 코드를 `state` 에 묶어 다른 제공자의 동의를 거친 뒤 두 코드로 한 번에 낸다. 주소가 없는 계정은 첫 비밀번호를 정할 수 없다(서버가 인증된 주소를 요구) — 안내만.

**이메일 변경 = 새 주소의 인증번호** — `POST /account/email/change`(다시 인증 포함) → 새 주소로 6자리 → 같은 세션에서 `POST /account/email/change/confirm {code}`(204 — 이 세션만 남고 다른 세션은 끊긴다, `me` · 세션 목록을 다시 읽는다). 단계는 `GET /account/me` 의 `pendingEmail` · `pendingEmailExpiresAt` 가 정한다 — 서버가 요청이 끝나기 전에 저장하므로 새로고침해도 코드 단계가 그대로 열린다(남의 주소면 서버가 같은 것을 보여 준다 — 존재를 숨긴다). 서버에 **취소 엔드포인트는 없다**: 「코드 다시 받기」는 같은 폼(다시 인증 포함)을 다시 제출하는 새 요청이 이전 것을 대신하는 것이고, 안 쓰면 만료된다.

**토큰 갱신** — `createSessionRefresher` 를 클라이언트의 `recoverUnauthorized` 에 꽂는다: 401 → 갱신 한 번(동시에 여러 요청이 401 이어도 한 번, 다른 요청 · 탭이 이미 갱신했으면 호출 없이) → 같은 요청 한 번 재시도. 새 리프레시 토큰을 먼저 저장하고(옛 것은 두 번 보내지 않는다 — 재사용은 서버가 세션을 끊는다), 탭 사이는 `navigator.locks` + `storage` 이벤트(`crossTab`)로 맞춘다. `AUTH.REFRESH_INVALID` · `REFRESH_REUSED` · `ACCOUNT_SUSPENDED` 면 두 저장소를 비우고 `onSessionEnded(reason)`. **`429 AUTH.TOO_MANY_REFRESHES`**(세션이 10분에 30번 넘게 회전)는 세션이 멀쩡하다는 뜻 — 로그아웃하지 않고 그 429 를 일시 오류로 내보낸 뒤, `Retry-After`(없으면 30초, 연속이면 두 배씩, 최대 10분)가 지나기 전에는 서버를 다시 부르지 않고 같은 오류를 돌려준다. 전달 방식 `body`(기본) | `cookie`(`createAuthApi(client, { delivery })` · `createApiClient({ withCredentials })` · 백엔드 `skeleton.auth-session.delivery`). 서버 렌더에서는 import 때 아무것도 읽지 않는다.

**로그아웃 · 계정 전환 때 서버 상태 비우기** — `onAccountChange(session, () => queryClient.clear())` 한 줄(앱의 `src/app/queryClient.ts`). 로그인한 계정이 사라지거나 바뀔 때마다(로그아웃 버튼 · 다른 탭의 로그아웃 · 갱신 실패 · 복구할 수 없는 401 · 링크 · 소셜로 다른 계정이 들어올 때) 불린다. 처음 로그인과 같은 계정의 토큰 갱신은 아니다. 쿼리 키에 계정이 없는 앱이 이전 사람의 데이터를 다음 사람에게 보이지 않게 한다.

**저장 키 이름공간** — 같은 출처에 앱 둘을 경로로 나눠 올려도 토큰 · 락이 섞이지 않게 `authStorageKeys('my-app')` 로 키를 만든다(`<ns>.accessToken` · `.refresh` · `.auth.refresh`(락) · `.returnTo` · `.social.` · `.social-link.`(제공자 왕복의 하려던 작업 · 계정) · `.signUp`). `createAuthRoutes({ namespace })` 에도 같은 이름을 준다. 생략하면 옛 이름 `skeleton`. 앱의 `AUTH_NAMESPACE` 는 `new-project.sh` 가 새 프로젝트 이름으로 찍는다.

**일회용 링크 도착 화면** — 비밀번호 재설정과 링크 로그인뿐이다. 링크 로그인은 도착하면 바로(계약이 마운트 POST 를 허용). 읽은 토큰 · OAuth 코드는 `history.replaceState` 로 주소창에서 지운다(`scrubUrlParams`). 앱 껍데기에는 `<meta name="referrer" content="no-referrer">` 를 둔다(서버는 `Referer` 에 기대지 않는다 — CSRF 는 `X-Requested-With` 헤더 · SameSite · CORS).

**쿠키 모드 — 한 줄 스위치** — 앱의 `src/auth/authConfig.ts` 의 `DEFAULT_REFRESH_DELIVERY = 'body'` 를 `'cookie'` 로(또는 `.env` 에 `VITE_AUTH_REFRESH_DELIVERY=cookie`). 짝지을 백엔드 설정은 `skeleton.auth-session.delivery=cookie`(리프레시 토큰이 HttpOnly · Secure · `SameSite=Strict` 쿠키 `skeleton_refresh` 로만 오가 스크립트가 못 읽는다 — XSS 에 강하다). 조건: 프런트와 API 가 **같은 사이트**(개발은 Vite 프록시 · 배포는 같은 도메인의 리버스 프록시), 갱신 · 로그아웃은 `X-Requested-With: fetch` 와 자격 증명 포함으로 나간다(앱이 `withCredentials` 로 이미 건다). 기본은 `body` + `localStorage`(탭 여러 개 · 새로고침에서 로그인 유지, 대신 XSS 에 리프레시 토큰이 노출) — 어느 쪽이 맞는지는 위협 모델이 정한다. `cookieDelivery.test.ts` 가 이 길(CSRF 헤더 · 자격 증명 · 저장소에 토큰 없음 · 짝이 안 맞을 때 한 번만 실패)을 통합해서 지킨다.

**갱신 도중 페이지가 이동하면**(응답을 잃는다) — 백엔드 `reuse-grace`(샘플 · 스타터 백엔드는 `10s`, 멱등 회전: 직전 토큰을 유예 안에 다시 내밀면 같은 후속 토큰)가 있으면 다음 페이지의 갱신이 이어진다. 모듈 기본 `0s` 에서는 같은 일이 탈취로 보여 세션이 닫힌다 — 클라이언트는 `onSessionEnded('reuse-detected')` 로 한 번 깨끗이 로그아웃하고 멈춘다(루프 없음). 둘 다 `refreshNavigation.test.ts`.

**소셜 `state`** — 로그인 · 연결 모두 `start()` 가 만든 `state` 를 `sessionStorage`(그 탭)에 두고, 콜백은 `state` 가 없거나 이 브라우저가 시작한 것과 다르면 요청 없이 거절한다(`state_mismatch`). 같은 콜백을 두 번 처리해도 요청은 한 번. 반드시 `storage: window.sessionStorage` 를 넘긴다(생략하면 메모리라 제공자에 다녀오면 사라진다).

**선택 내보내기 `@skeleton/auth/admin`** — `AdminAccounts` · `AdminAccountsTable` · `createAdminAccountsApi`(백엔드 `skeleton.account.admin.enabled=true` + ADMIN). 쓰지 않으면 번들에 들어가지 않는다. 가드는 `RequireRole roles={['ADMIN']}`(역할 없음 = 로그아웃이 아니라 「접근 차단」 안내).

화면은 `Patterns/Auth/*` 스토리(로그인 · 가입 · 메일 링크 도착 · 계정 설정 · 운영자 표)가 정본이다. 문구는 모두 `labels` prop — 기본 영어, `koAuthLabels` 한국어, 그 밖의 언어는 `AuthLabels` 타입을 채운다(빠진 키는 컴파일 오류).

백엔드 계약(`docs/account-http-contract.md`)에서 이 패키지가 기대는 것: 응답 `AuthTokenResponse.{accessToken, refreshToken?, refreshExpiresAt?, sessionId?}` · 오류 코드 `AUTH.{EMAIL_NOT_VERIFIED, ACCOUNT_SUSPENDED, TOO_MANY_ATTEMPTS, REFRESH_INVALID, REFRESH_REUSED, TOO_MANY_REFRESHES(429 — 세션 유지)}` · `ACCOUNT.{TOKEN_INVALID(410 — 재설정 · 링크 로그인만), CODE_INVALID(400, data.attemptsLeft), CODE_EXPIRED(410), PASSWORD_POLICY(data.violations), CURRENT_PASSWORD_INVALID, REAUTH_FAILED, REAUTH_REQUIRED(403), EMAIL_TAKEN, SIGN_UP_CLOSED, CAPTCHA_FAILED, SOCIAL_EMAIL_CONFLICT, LAST_SIGN_IN_METHOD, RATE_LIMITED(data.retryAfterSeconds)}` · 정책 `GET /account/password/policy` 의 `maxBytes`(문서의 `maxLength` 도 받는다) · `Idempotency-Key`(이메일 변경 · 삭제) · 이메일 변경 확인은 이 세션을 남기고 다른 세션만 닫는다 · 소셜 연결 해제 · 이메일 변경 확인 뒤에는 세션 목록을 다시 읽는다(서버가 다른 세션을 닫는다) · 운영자 호출의 403 은 로그아웃이 아니라 「접근 차단」(저장된 계정이 더는 활성 관리자가 아니어도 토큰은 살아 있다) · 운영자 목록은 `size ≤ 100` · `page ≥ 0` 으로 맞춰 부른다.

## 비밀번호 확인 · 제출이 막혔을 때

- **비밀번호 확인 칸**(`confirmPassword`, 기본 **켜짐**) — 가입 · 비밀번호 재설정 · 비밀번호 변경 · 첫 비밀번호 정하기. 확인 칸을 건드린 뒤부터 일치 여부를 바로 알려 주고(「비밀번호가 일치하지 않아요」 / 「일치해요」), 다르면 제출하지 않는다. 「보기」 하나가 두 칸을 함께 보이고, 둘 다 `autocomplete="new-password"` 이며 붙여넣기를 막지 않는다. 성공하면 두 칸이 함께 비워지고 **확인 값은 API 로 가지 않는다**. 끄기: `<SignUpScreen confirmPassword={false} />` · `<ResetPasswordScreen confirmPassword={false} />` · `<PasswordSection confirmPassword={false} />` · `<AccountSettings confirmPassword={false} />`, 또는 `createAuthRoutes({ confirmPassword: false })`(가입만 따로: `signUp: { confirmPassword }`). 문구: `passwordConfirm` · `passwordMismatch` · `passwordConfirmMissing` · `passwordMatches`(ko · en 사전에 있다).
- **제출이 막히면 반드시 말한다** — 가입 · 로그인 · 비밀번호 찾기 · 재설정 · 비밀번호 변경 · 이메일 변경 · 소셜 연결 본인 확인 · 계정 삭제에서, 비었거나 틀린 채로 제출 버튼을 누르면 ① 버튼 바로 위에 `role="alert"` 요약(`@skeleton/ui` 의 `FormProblems` — 줄은 그 칸으로 데려가는 버튼) ② 첫 틀린 칸으로 포커스 + 스크롤 ③ 틀린 칸에 오류 테두리 + `aria-invalid`. 고치면 곧바로 사라진다. **제출 버튼은 꺼 두지 않는다**(본인 확인 전의 「계정 삭제」 · 「비밀번호 변경」도 눌리고 이유를 말한다). 문구: `formProblemsTitle` · `problemEmailMissing` · `problemEmailInvalid` · `problemPasswordMissing` · `problemPasswordRules` · `problemConsentMissing` · `problemProofMissing`.

## 공개 표면

| export                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 뜻                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `createSessionRefresher` · `createRefreshStore` · `createAccountApi` · `createAuthRoutes`                                                                                                                                                                                                                                                                                                                                                                  | 위 절                                                  |
| `SignInScreen` · `SignUpScreen` · `VerifyCodePanel` · `ReauthProof` · `CheckEmailPanel`(재설정 · 링크 로그인) · `MagicLinkLanding` · `LegacyLinkNotice` · `SocialLinkProofScreen` · `DiscoveryLoading` · `ForgotPasswordScreen` · `ResetPasswordScreen` · `SocialCallbackScreen` · `AccountStateNotice` · `AccountSettings`(+ `ProfileSection` · `PasswordSection` · `EmailSection` · `SignInMethodsSection` · `SessionsSection` · `DeleteAccountSection`) | 화면 · 절 — 문구 `labels`, 방법 `methods`              |
| `RequireRole` · `postSignInTarget` · `safeReturnPath` · `rememberReturnTo` · `consumeReturnTo`                                                                                                                                                                                                                                                                                                                                                             | 가드 · 로그인 뒤 돌아가기(같은 출처 경로만)            |
| `passwordRequirements` · `passwordStrength` · `violationsOf`                                                                                                                                                                                                                                                                                                                                                                                               | 서버 정책과 같은 규칙으로 힌트 · 강도 · 서버 위반 읽기 |
| `createSocialLinkFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                     | 로그인한 계정에 소셜 제공자 더하기                     |

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
