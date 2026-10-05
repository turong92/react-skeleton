export type DevLoginIdentity = {
  accountId?: string
  username?: string
  email?: string
}

export type BreakGlassIdentity = {
  accountId: string
  reason: string
  secret: string
}

/** 백엔드 `CurrentPrincipal`(auth 모듈). `roles` 는 `Set<String>` 이라 JSON 배열 */
export type AuthPrincipal = {
  accountId: string
  username?: string | null
  email?: string | null
  roles: string[]
}

/** 백엔드 `AuthTokenResponse`. `expiresAt` 은 `Instant` → ISO 문자열 */
export type AuthTokenResponse = {
  accessToken: string
  tokenType: string
  expiresAt: string
  principal: AuthPrincipal
}

/**
 * 백엔드 `PasswordLoginRequest` — `accountId` · `username` · `email` 중 하나(`@RequiredLoginIdentifier`)와 `password`.
 */
export type PasswordLoginRequest = {
  accountId?: string
  username?: string
  email?: string
  password: string
}

/** 백엔드 `OAuthSocialLoginRequest` */
export type SocialLoginRequest = {
  authorizationCode: string
  redirectUri?: string
}

export type AuthStatus = 'anonymous' | 'authenticated'

export type AuthState = {
  status: AuthStatus
  token: string | null
  principal: AuthPrincipal | null
}
