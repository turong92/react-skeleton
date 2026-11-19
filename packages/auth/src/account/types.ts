/** 계정 수명주기 DTO — kotlin-skeleton `docs/account-http-contract.md` 와 `modules/account` 컨트롤러를 그대로 옮긴 것 */

export type SignUpRequest = {
  email: string
  password: string
  displayName?: string
  locale?: string
  timeZone?: string
  captchaToken?: string
  /** 로그인 아이디 — 서버가 켰을 때(`GET /auth/methods` 에 `loginId` 키)만 필수, 꺼져 있으면 서버가 읽지 않는다. 대문자도 받는다(소문자로 저장) */
  loginId?: string
  /** 체크한 약관 · 방침 — `{종류, 판, 언어}`(백엔드 legal 모듈이 있을 때. 없으면 서버가 무시한다) */
  consents?: Array<{ type: string; version: string; locale?: string }>
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
  /** 서버가 붙이는 4자리 꼬리표(`수민#4821`) — 꼬리표 방식이 꺼진 서버 · 옛 서버는 null · 없음 */
  displayTag?: string | null
  locale: string | null
  timeZone: string | null
  roles: string[]
  status: AccountStatus
  createdAt: string
  hasPassword: boolean
  methods: SignInIdentity[]
  /** 새 주소의 확인을 기다리는 이메일 변경(만료 · 대체 · 확정 전까지) — 새로고침 뒤에도 서버가 알려 준다. 남의 주소로 요청했으면 null(존재 여부를 숨긴다) */
  pendingEmail?: string | null
  pendingEmailExpiresAt?: string | null
  /** 이메일을 **필수**로 켠 앱에서만 키가 있다: 주소가 아직 없으면 true — 허용 목록 밖의 모든 호출이 403 `ACCOUNT.EMAIL_REQUIRED` 라 「이메일을 등록해 주세요」 화면이 앱을 덮는다. 키가 없으면 이 앱은 주소를 요구하지 않는다 */
  emailRequired?: boolean
  /** "쓰기 때" 방식의 이메일(`required-when: WRITE`)에서만 키가 있다: 주소가 없으면 true - 읽기는 되고 변경 요청이 403 `ACCOUNT.EMAIL_REQUIRED` 다. 그 앱에서 `emailRequired` 는 늘 false */
  emailRequiredToWrite?: boolean
  /** 로그인 아이디(비공개 · 바꿀 수 없다) - **키가 있으면 서버가 이 기능을 켰다**, null 은 아직 안 정했다(허용 목록 밖의 호출이 403 `ACCOUNT.LOGIN_ID_REQUIRED` 라 아이디 화면이 앱을 덮는다). 키가 없으면 이 앱은 아이디를 쓰지 않는다 */
  loginId?: string | null
  /** 확인된 연락받을 이메일 — **키가 없으면 서버가 이 기능을 껐다**(옛 서버 포함), null 은 켜져 있고 아직 등록하지 않았다는 뜻. 서비스 알림 · 공지가 간다. 로그인 · 비밀번호 찾기에는 쓰이지 않는다 */
  contactEmail?: string | null
  /**
   * 프로필 사진의 업로드 키 - **키가 없으면 서버가 이 기능을 껐다**(`storage` 없음), null 은 켜져 있고 아직 없다. 키는 본인에게만 나간다.
   */
  avatarKey?: string | null
  /** 사진이 있고 기능이 켜졌을 때만 - 공개 주소 · 변환본 · 변환 중. 세 칸이 모두 비면 보일 공개 모습이 없다(공개 영역이 꺼짐) */
  avatar?: AccountAvatar
}

/** `me.avatar` - 공개 영역이 켜졌을 때 `url`(원본 크기) · `image`(변환이 끝난 `thumb` · `display` 주소), 변환 중이면 `pending` */
export type AccountAvatar = {
  url?: string
  image?: { width: number; height: number; thumb: string; display: string }
  pending?: boolean
}

/** `GET /account/me/avatar` - 짧은 수명의 서명 읽기 주소(공개 영역이 켜져 있을 때만; 사진이 없거나 변환 중이면 404) */
export type AvatarAddress = { url: string; expiresInSeconds: number }

/** `POST /account/login-id/availability` 의 값 - 「쓸 수 있음」은 예약이 아니다(내는 순간 서버가 다시 판정한다). `TAKEN` 은 쓰는 · 탈퇴한 · 예약된 아이디를 구분하지 않는다 */
export type LoginIdAvailability = {
  /** 서버가 정규화한 값(앞뒤 공백 제거 + 소문자) - 저장될 모양 */
  normalized: string
  available: boolean
  reason?: 'INVALID' | 'TAKEN'
  /** `reason: 'INVALID'` 일 때 - `Pattern` 은 맨 앞뒤 · 연속 기호 · 숫자만을 모두 포함한다 */
  code?: 'Required' | 'Size' | 'Pattern'
}

export type ProfilePatch = {
  displayName?: string
  locale?: string
  timeZone?: string
  /** 프로필 사진 키: 문자열 = 설정, `null` = 지움, 키 없음 = 그대로 */
  avatarKey?: string | null
}

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
  /** 로그인 아이디를 켠 앱에서만 키가 있다(null = 아직 안 정했다) */
  loginId?: string | null
}
