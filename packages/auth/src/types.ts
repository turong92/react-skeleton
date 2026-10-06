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
  /** auth-session 이 설치된 백엔드가 채운다 */
  sessionId?: string | null
}

/** 백엔드 `AuthTokenResponse`. `expiresAt` 은 `Instant` → ISO 문자열 */
export type AuthTokenResponse = {
  accessToken: string
  tokenType: string
  expiresAt: string
  principal: AuthPrincipal
  /** `body` 전달 모드(기본)에서만 — `cookie` 모드와 auth-session 이 없는 백엔드에는 없다 */
  refreshToken?: string
  refreshExpiresAt?: string
  sessionId?: string
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

/** 제공자가 PKCE · nonce 를 어떻게 다루는가 — `GET /auth/methods` 의 `social[].pkce` · `nonce` */
export type SocialMode = 'REQUIRED' | 'SUPPORTED' | 'UNSUPPORTED'

/** 제공자 authorize 화면으로 보낼 주소의 재료 — `social[].authorize`(백엔드가 알려 준다, 프런트는 제공자 주소를 모른다) */
export type SocialAuthorizeInfo = {
  url: string
  scopes: string[]
  params: Record<string, string>
}

/** 인가 코드와 함께 서버로 가는, 그 **시도** 의 PKCE verifier · nonce — 쓰지 않는 제공자에는 없다 */
export type SocialProof = { codeVerifier?: string; nonce?: string }

/** 백엔드 `OAuthSocialLoginRequest` */
export type SocialLoginRequest = {
  authorizationCode: string
  redirectUri?: string
} & SocialProof

export type AuthStatus = 'anonymous' | 'authenticated'

export type AuthState = {
  status: AuthStatus
  token: string | null
  principal: AuthPrincipal | null
}

/** `GET /auth/methods` 의 값(계약 FINAL-2b) — 모양은 `normalizeMethodsInfo` 가 느슨하게 읽는다 */
export type AuthMethodsWire = {
  /** 소셜을 뺀 방법: `password` · `magic_link` */
  methods: string[]
  signUp: { password: boolean; emailVerification: boolean; social: boolean }
  social: Array<{
    provider: string
    clientId: string | null
    redirectUri: string | null
    /** 없으면(옛 백엔드) 아무것도 새로 보내지 않는다 */
    pkce?: SocialMode
    nonce?: SocialMode
    authorize?: SocialAuthorizeInfo
  }>
  captchaRequired: boolean
  /** auth-session 이 없으면 null */
  refreshDelivery: 'body' | 'cookie' | null
}
