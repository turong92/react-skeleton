/** 계정 수명주기 DTO — kotlin-skeleton `docs/account-http-contract.md` 와 `modules/account` 컨트롤러를 그대로 옮긴 것 */

export type SignUpRequest = {
  email: string
  password: string
  displayName?: string
  locale?: string
  timeZone?: string
  captchaToken?: string
}

/** 가입 응답. 메일 인증이 켜져 있으면 늘 `VERIFICATION_SENT`(202), 꺼져 있으면 `CREATED`(201) */
export type SignUpStatus = 'VERIFICATION_SENT' | 'CREATED'

/** `GET /account/password/policy`. (계약 문서는 `maxLength` 라 적었으나 컨트롤러는 `maxBytes` — UTF-8 바이트 수) */
export type PasswordPolicy = {
  minLength: number
  maxBytes: number
  requireLetter: boolean
  requireDigit: boolean
  requireSymbol: boolean
  forbidEmailLocalPart: boolean
}

/** 백엔드 `PasswordViolation` — `ACCOUNT.PASSWORD_POLICY` 의 `data.violations` */
export type PasswordViolation =
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'NEEDS_LETTER'
  | 'NEEDS_DIGIT'
  | 'NEEDS_SYMBOL'
  | 'CONTAINS_EMAIL'
  | 'TOO_COMMON'
  | 'BREACHED'

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED' | (string & {})

/** 로그인 수단 한 줄(`methods[]` · `GET /account/identities`). `method` 는 `password` · `magic_link` · 소셜 제공자 코드 */
export type SignInIdentity = {
  id: string
  method: string
  /** 이메일 꼴 수단만(소셜은 null) */
  subject: string | null
  verified: boolean
  createdAt: string
  lastUsedAt: string | null
  /** 서버가 계산한 「지금 떼도 되는가」 — 마지막 수단이면 false */
  removable: boolean
}

export type AccountMe = {
  id: string
  email: string | null
  emailVerified: boolean
  displayName: string | null
  locale: string | null
  timeZone: string | null
  roles: string[]
  status: AccountStatus
  createdAt: string
  hasPassword: boolean
  methods: SignInIdentity[]
}

export type ProfilePatch = { displayName?: string; locale?: string; timeZone?: string }

export type DeletionResult = { status: 'DELETION_SCHEDULED'; purgeAfter: string }

export type AccountSession = {
  id: string
  deviceName: string | null
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastUsedAt: string
  current: boolean
}

export type AdminAccount = {
  id: string
  email: string | null
  status: AccountStatus
  roles: string[]
  displayName: string | null
  createdAt: string
  lastLoginAt: string | null
  suspendedReason: string | null
  purgeAfter: string | null
}
