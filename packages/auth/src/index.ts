export type {
  AuthPrincipal,
  AuthState,
  AuthStatus,
  AuthTokenResponse,
  BreakGlassIdentity,
  DevLoginIdentity,
  PasswordLoginRequest,
  SocialLoginRequest,
  SocialMode,
  SocialAuthorizeInfo,
  SocialProof,
} from './types'
export {
  applyAuthHeaders,
  bearerAuthorization,
  breakGlassHeaders,
  devLoginHeaders,
  parseDevIdentity,
  requestAuthHeaders,
} from './headers'
export type { RequestAuthOptions } from './headers'
export { decodeTokenPrincipal } from './principal'
export { createTokenStore, DEFAULT_TOKEN_STORAGE_KEY } from './tokenStore'
export type { TokenStorage, TokenStore, TokenStoreOptions } from './tokenStore'
export { createAuthApi } from './authApi'
export type { AuthApi } from './authApi'
export { createAuthHeadersProvider, createUnauthorizedHandler } from './apiClientHooks'
export type { UnauthorizedHandlerOptions } from './apiClientHooks'
export { createAuthSession } from './session'
export type { AuthSession, AuthSessionOptions } from './session'
export { AuthProvider } from './AuthProvider'
export { useAuth } from './useAuth'
export { CodeClockProvider } from './codeClock'
export { useCodeClock } from './codeClockContext'
export { codeWindowOf, estimateCodeWindow, type CodeWindow } from './codeWindow'
export type { AuthContextValue } from './authContext'
export { RequireAuth } from './RequireAuth'
export type { RequireAuthProps } from './RequireAuth'
export {
  buildAuthorizeUrl,
  createSocialLoginFlow,
  parseSocialCallback,
  SOCIAL_AUTHORIZE_PRESETS,
  SocialLoginCallbackError,
} from './social'
export type {
  SocialCallback,
  SocialAction,
  AuthorizeExtras,
  SocialComplete,
  SocialStart,
  SocialLoginCallbackFailure,
  SocialLoginFlow,
  SocialLoginFlowOptions,
  SocialProviderConfig,
} from './social'
export {
  codeChallengeS256,
  createCodeVerifier,
  createNonce,
  createState,
  hasWebCrypto,
  PkceUnavailableError,
} from './pkce'
export { KNOWN_PROVIDER_CODES, providerPresentation } from './screens/providers'
export { useSocialLoginCallback } from './useSocialLoginCallback'
export type { SocialCallbackState } from './useSocialLoginCallback'

// 세션: 갱신(single-flight · 회전 안전 · 탭 사이 락) · 리프레시 저장소 · 탭 사이 동기화
export { authStorageKeys } from './storageKeys'
export type { AuthStorageKeys } from './storageKeys'
export { accountKeyOf, onAccountChange } from './accountChange'
export type { AccountChange } from './accountChange'
export { createSessionRefresher } from './sessionRefresher'
export type {
  LockManagerLike,
  SessionEndReason,
  SessionRefresher,
  SessionRefresherOptions,
} from './sessionRefresher'
export { createRefreshStore, DEFAULT_REFRESH_STORAGE_KEY } from './refreshStore'
export type { RefreshCredentials, RefreshStore, RefreshStoreOptions } from './refreshStore'
export type { CrossTabOption, StorageEventSource } from './crossTab'
export type { AuthApiOptions, RefreshDelivery } from './authApi'
export { createSocialLinkFlow } from './socialLink'
export type {
  ProviderAction,
  SocialLinkCallback,
  SocialLinkContext,
  SocialLinkFlow,
  SocialLinkFlowOptions,
} from './socialLink'

// 가드 · 로그인 뒤 돌아가기
export { RequireRole } from './RequireRole'
export type { RequireRoleProps } from './RequireRole'
export {
  consumeReturnTo,
  locationPath,
  postSignInTarget,
  rememberReturnTo,
  safeReturnPath,
} from './returnTo'

// 로그인 방법 발견(`GET /auth/methods`)
export {
  clearAuthMethodsCache,
  deliveryMismatch,
  loadAuthMethods,
  methodsFromInfo,
  normalizeMethodsInfo,
  peekAuthMethods,
  redirectUriProblems,
} from './discovery'
export type { DiscoveredMethods, MethodsFromInfoOptions, RedirectUriProblem } from './discovery'
export { useAuthMethods } from './screens/useAuthMethods'
export type { AuthMethodsState } from './screens/useAuthMethods'
export { DiscoveryLoading } from './screens/DiscoveryLoading'
export type { DiscoveryOptions } from './routes/discovery'
export type { AuthMethodsWire } from './types'

// 다시 인증 — 민감한 작업(이메일 변경 · 첫 비밀번호 · 소셜 연결 · 해제 · 삭제)에 계정에 맞는 증거 하나: 비밀번호 · 메일 인증번호(그 자리에서 입력) · 제공자 동의
export { isReauthFailure, reauthKindOf, reauthSubjectOf } from './reauth/kind'
export type { ReauthKind, ReauthSubject } from './reauth/kind'
export { scrubUrlParams } from './scrubUrl'

// 계정 API · 규칙
export { createAccountApi } from './account/accountApi'
export type { AccountApi, CodeSent, ReauthCredential, SocialReauth } from './account/accountApi'
export { passwordRequirements, passwordStrength, violationsOf } from './account/passwordRules'
export type { PasswordRequirement } from './account/passwordRules'
export { supportedTimeZones } from './account/timeZones'
export type {
  AccountMe,
  AccountSession,
  AccountStatus,
  DeletionResult,
  PasswordPolicy,
  PasswordViolation,
  ProfilePatch,
  SignInIdentity,
  SignUpRequest,
  SignUpStatus,
} from './account/types'

// 화면 — 문구는 `labels` prop(기본 영어), 로그인 방법은 `methods` 설정
export { defaultAuthLabels, mergeLabels } from './screens/labels'
export { koAuthLabels } from './screens/labels.ko'
export type { AuthLabels } from './screens/labels'
export { DISPLAY_NAME_MAX_LENGTH, displayNameProblem } from './screens/displayName'
export type { DisplayNameMode } from './screens/displayName'
export { resolveMethods } from './screens/methods'
export type { SignInMethodsConfig, SocialProviderButton } from './screens/methods'
export { authErrorMessage } from './screens/errors'
export type { AuthErrorInfo } from './screens/errors'
export { readLinkToken } from './screens/linkToken'
export { AuthLayout } from './screens/AuthLayout'
export { SignInScreen } from './screens/SignInScreen'
export type { SignInScreenProps } from './screens/SignInScreen'
export { SignUpScreen } from './screens/SignUpScreen'
export type {
  AcceptedConsent,
  CaptchaSlotApi,
  ConsentItem,
  SignUpScreenProps,
  ConsentSlotApi,
  SignUpSubmit,
} from './screens/SignUpScreen'
export { CheckEmailPanel } from './screens/CheckEmailPanel'
export type { CheckEmailPanelProps } from './screens/CheckEmailPanel'
export { PasswordHints } from './screens/PasswordHints'
export { PasswordField } from './screens/PasswordField'
export { SocialButtons } from './screens/SocialButtons'
export { TokenLanding } from './screens/TokenLanding'
export { MagicLinkLanding } from './screens/MagicLinkLanding'
export { LegacyLinkNotice } from './screens/LegacyLinkNotice'
export type { LegacyLinkNoticeProps } from './screens/LegacyLinkNotice'
export { ReauthProof } from './screens/ReauthProof'
export type { ReauthProofProps } from './screens/ReauthProof'
export { VerifyCodePanel } from './screens/VerifyCodePanel'
export type { VerifyCodePanelProps } from './screens/VerifyCodePanel'
export { SocialLinkProofScreen } from './screens/SocialLinkProofScreen'
export type { SocialLinkProofScreenProps } from './screens/SocialLinkProofScreen'
export { ForgotPasswordScreen } from './screens/ForgotPasswordScreen'
export { ResetPasswordScreen } from './screens/ResetPasswordScreen'
export { SocialCallbackScreen } from './screens/SocialCallbackScreen'
export { DeletionPendingScreen } from './screens/DeletionPendingScreen'
export type { DeletionPendingScreenProps } from './screens/DeletionPendingScreen'
export { deletionPendingOf } from './pendingDeletion'
export type { DeletionPending } from './pendingDeletion'
export { AccountStateNotice } from './screens/AccountStateNotice'
export { AccountSettings } from './screens/AccountSettings'
export type { AccountSectionName, AccountSettingsProps } from './screens/AccountSettings'
export { ProfileSection } from './screens/ProfileSection'
export { PasswordSection } from './screens/PasswordSection'
export { EmailSection } from './screens/EmailSection'
export { SignInMethodsSection } from './screens/SignInMethodsSection'
export { SessionsSection } from './screens/SessionsSection'
export { DeleteAccountSection } from './screens/DeleteAccountSection'
export { useCountdown } from './screens/useCountdown'

// 라우트 한 벌
export {
  createAuthRoutes,
  DEFAULT_AUTH_PATHS,
  DEFAULT_LEGACY_LINK_PATHS,
} from './routes/createAuthRoutes'
export type { AuthPageName, AuthPaths, AuthRoutesOptions } from './routes/createAuthRoutes'
