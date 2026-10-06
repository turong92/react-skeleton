export type {
  AuthPrincipal,
  AuthState,
  AuthStatus,
  AuthTokenResponse,
  BreakGlassIdentity,
  DevLoginIdentity,
  PasswordLoginRequest,
  SocialLoginRequest,
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
  SocialLoginCallbackFailure,
  SocialLoginFlow,
  SocialLoginFlowOptions,
  SocialProviderConfig,
} from './social'
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
export type { SocialLinkCallback, SocialLinkFlow, SocialLinkFlowOptions } from './socialLink'

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
} from './discovery'
export type { DiscoveredMethods, MethodsFromInfoOptions } from './discovery'
export { useAuthMethods } from './screens/useAuthMethods'
export type { AuthMethodsState } from './screens/useAuthMethods'
export { DiscoveryLoading } from './screens/DiscoveryLoading'
export type { DiscoveryOptions } from './routes/discovery'
export type { AuthMethodsWire } from './types'

// 다시 인증(비밀번호 없는 계정) — 하려던 작업을 메일 링크 왕복 동안 기억한다
export { createReauthStore, submitWithReauth } from './reauth'
export type {
  PendingReauthAction,
  ReauthStore,
  ReauthStoreOptions,
  SubmitWithReauthResult,
} from './reauth'
export { createBroadcastReauthChannel, listenForReauthToken } from './reauthChannel'
export type { ReauthChannel, ReauthOfferHandler } from './reauthChannel'
export { scrubUrlParams } from './scrubUrl'
export { resolveReauthLanding } from './reauthLanding'
export type { ReauthLandingOutcome } from './reauthLanding'

// 계정 API · 규칙
export { createAccountApi } from './account/accountApi'
export type { AccountApi, ReauthCredential } from './account/accountApi'
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
  SignUpSubmit,
} from './screens/SignUpScreen'
export { CheckEmailPanel } from './screens/CheckEmailPanel'
export type { CheckEmailPanelProps } from './screens/CheckEmailPanel'
export { PasswordHints } from './screens/PasswordHints'
export { PasswordField } from './screens/PasswordField'
export { SocialButtons } from './screens/SocialButtons'
export { TokenLanding } from './screens/TokenLanding'
export { VerifyEmailScreen } from './screens/VerifyEmailScreen'
export { MagicLinkLanding } from './screens/MagicLinkLanding'
export { ConfirmEmailChangeLanding } from './screens/ConfirmEmailChangeLanding'
export { ConfirmReauthLanding } from './screens/ConfirmReauthLanding'
export type { ConfirmReauthLandingProps } from './screens/ConfirmReauthLanding'
export { SocialLinkPasswordScreen } from './screens/SocialLinkPasswordScreen'
export type { SocialLinkPasswordScreenProps } from './screens/SocialLinkPasswordScreen'
export { ForgotPasswordScreen } from './screens/ForgotPasswordScreen'
export { ResetPasswordScreen } from './screens/ResetPasswordScreen'
export { SocialCallbackScreen } from './screens/SocialCallbackScreen'
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
export { createAuthRoutes, DEFAULT_AUTH_PATHS } from './routes/createAuthRoutes'
export type { AuthPageName, AuthPaths, AuthRoutesOptions } from './routes/createAuthRoutes'
