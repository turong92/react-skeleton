import type { PasswordViolation } from '../account/types'

/**
 * 화면 문구. `@skeleton/auth` 는 번역을 모른다 — 모든 화면이 `labels?: Partial<AuthLabels>` 를 받고, 기본은 영어다.
 * 앱이 자기 i18n 으로 채워 넘긴다(`createAuthRoutes` 의 `useLabels` 훅). 값이 함수인 항목은 자리값이 낀 문장이다.
 */
export type AuthLabels = {
  // 공통
  email: string
  password: string
  newPassword: string
  currentPassword: string
  displayName: string
  /** 닉네임 칸 아래 안내 */
  displayNameHint: string
  /** 설정 · 프로필에서 `닉네임#번호` 를 보여 주는 줄의 이름 */
  displayNameShownAs: string
  errorDisplayNameTaken: string
  /** 가입 인증 단계에서 닉네임이 겹쳤을 때 — 닉네임만 바꿔 처음부터 */
  problemDisplayNamePattern: string
  problemDisplayNameReserved: string
  /** 닉네임 변경 한도(`429 ACCOUNT.RATE_LIMITED`) — `{wait}` 는 `durationHours` · `durationMinutes` · `durationSeconds` 로 만든 글자 */
  errorDisplayNameRateLimited: (wait: string) => string
  durationHours: (n: number) => string
  durationMinutes: (n: number) => string
  durationSeconds: (n: number) => string
  /** 가입 인증번호 단계에서 닉네임이 겹쳤을 때, 그 자리에서 닉네임만 다시 받는 칸 */
  nicknameRetryHint: string
  nicknameRetryAction: string
  /** 서버가 더 다시 보낼 수 없다고 알렸다(`resendAvailableAt: null`) */
  codeNoMoreResends: string
  /** 더 다시 보낼 수 없는 번호의 시간이 다 됐다 — 「다시 받아 주세요」가 아니라 처음부터 */
  codeTimeUpNoResend: string
  codeNoMoreResendsSignUp: string
  errorErased: string
  errorErasureInProgress: string
  errorErasureRetry: string
  errorNotSuspended: string
  problemDisplayNameMissing: string
  problemDisplayNameTooLong: (max: number) => string
  or: string
  back: string
  continue: string
  submitting: string
  save: string
  saved: string
  cancel: string
  copyHint: string
  // 에러 · 상태
  errorInvalidCredentials: string
  errorEmailNotVerified: string
  errorSuspended: string
  /** `AUTH.ACCOUNT_DELETION_PENDING` 를 아무도 처리하지 않는 자리에서의 일반 문구(화면은 전용 안내를 그린다) */
  errorDeletionPending: string
  /** `ACCOUNT.SUSPENDED_CANNOT_DELETE` — 정지된 계정은 스스로 탈퇴할 수 없다 */
  errorSuspendedCannotDelete: string
  /** `ACCOUNT.REGISTRATION_BLOCKED` — 가입이 막힌 주소 · 제공자 계정(메일함 · 제공자를 증명한 사람에게만 보인다) */
  errorRegistrationBlocked: string
  errorBlocked: string
  errorTooManyAttempts: string
  errorRateLimited: string
  errorRetryIn: (seconds: number) => string
  errorTokenInvalid: string
  errorEmailTaken: string
  errorSignUpClosed: string
  errorCaptcha: string
  errorCurrentPassword: string
  errorReauth: string
  errorReauthRequired: string
  errorLastMethod: string
  errorLastAdmin: string
  errorSelfAction: string
  /** 다른 계정이 그 소셜을 쥐고 있다(내가 끊은 뒤 그 소셜로 다시 로그인해 생긴 계정일 수 있다) — 제공자 이름을 모를 때 */
  errorIdentityTaken: string
  /** 같은 말, 제공자 이름을 아는 화면(연결 화면 · 연결 콜백)에서 */
  errorIdentityTakenFor: (provider: string) => string
  errorIdentityExists: string
  errorSocialConflict: string
  /** 400 `LEGAL.CONSENT_REQUIRED` — 가입하는 사이 약관이 바뀌었다 */
  errorConsentRequired: string
  /** 400 `AUTH.SOCIAL_PKCE_FAILED` · `AUTH.SOCIAL_NONCE_FAILED` — 요청이 안전하게 만들어지지 않았다(아직 아무것도 쓰이지 않았다) */
  errorSocialRequest: string
  /** 401 `AUTH_SOCIAL.INVALID_AUTHORIZATION_CODE` · `AUTH.SOCIAL_ID_TOKEN_INVALID` — 동의를 처음부터 */
  errorSocialCode: string
  /** 502 `AUTH_SOCIAL.PROVIDER_GATEWAY_ERROR` */
  errorSocialGateway: string
  /** WebCrypto 가 없어 PKCE 필수 제공자를 시작할 수 없다 */
  errorPkceUnavailable: string
  errorValidation: string
  errorNetwork: string
  errorGeneric: string
  errorReference: (traceId: string) => string
  sessionEnded: Record<'expired' | 'reuse-detected' | 'suspended' | 'unauthenticated', string>
  // 비밀번호 규칙
  passwordRequirementsTitle: string
  passwordStrengthLabel: string
  passwordStrength: [string, string, string, string, string]
  passwordRule: Record<PasswordViolation, string>
  requirementMet: string
  requirementUnmet: string
  show: string
  hide: string
  /** 비밀번호 확인 칸의 라벨(가입 · 재설정 · 변경 · 첫 설정) */
  passwordConfirm: string
  passwordMismatch: string
  passwordConfirmMissing: string
  passwordMatches: string
  /** 제출이 막혔을 때 버튼 위 오류 요약(`role="alert"`)의 머리글과 줄 */
  formProblemsTitle: string
  problemEmailMissing: string
  problemEmailInvalid: string
  problemPasswordMissing: string
  problemPasswordRules: string
  problemConsentMissing: string
  problemProofMissing: string
  // 로그인
  signInTitle: string
  signInSubtitle: string
  signInSubmit: string
  signInForgot: string
  signInNoAccount: string
  signInCreateAccount: string
  signInWithProvider: (provider: string) => string
  signInMagicLink: string
  signInMagicLinkHelp: string
  signInMagicLinkSubmit: string
  signInUsePassword: string
  providerNames: Record<string, string>
  /** 제공자별 버튼 글자 전체(조사가 이름에 달려 있는 언어용) — 없으면 `signInWithProvider(이름)` */
  providerSignInText: Record<string, string>
  // 가입
  signUpTitle: string
  signUpSubtitle: string
  signUpSubmit: string
  signUpHaveAccount: string
  signUpSignIn: string
  signUpClosedTitle: string
  signUpConsentRequired: string
  signUpCaptcha: string
  // 인증번호 입력
  /** 메일로 받은 6자리 인증번호를 같은 화면에서 입력한다(가입 인증 · 이메일 변경) */
  codeTitle: string
  codeBody: (email: string) => string
  codeGroupLabel: string
  codeDigit: (position: number, total: number) => string
  codeInvalid: (attemptsLeft: number | undefined) => string
  codeExpired: string
  codeRestart: string
  codeResend: string
  codeResent: string
  codeResendIn: (seconds: number) => string
  /** 쿨다운 동안 「다시 받기」 버튼 글자 — 예: `다시 받기 (27초)` */
  codeResendWaiting: (seconds: number) => string
  /** 칸 옆의 남은 시간 줄 — 예: `남은 시간 09:42` */
  codeTimeLeft: (clock: string) => string
  /** 60초 아래가 되는 순간 한 번 읽는 문구 */
  codeTimeMinute: string
  /** 10초 아래가 되는 순간 한 번 읽는 문구 */
  codeTimeTen: string
  /** 시간이 다 됐다(보이고 읽힌다) */
  codeTimeUp: string
  codeChecking: string
  checkEmailTitle: string
  checkEmailBody: (email: string) => string
  checkEmailSpam: string
  checkEmailResend: string
  checkEmailResent: string
  checkEmailResendIn: (seconds: number) => string
  checkEmailWrongAddress: string
  /** 오래된 메일 링크 도착 화면(가입 인증 · 이메일 변경 · 본인 확인 · 삭제 확인은 이제 6자리 인증번호) */
  legacyLinkTitle: string
  legacyLinkBody: string
  legacyLinkAction: string
  // 다시 인증(비밀번호 · 메일로 받은 인증번호 · 제공자 동의)
  reauthTitle: string
  reauthCodeHint: (email: string) => string
  reauthCodeSend: string
  reauthCodeSent: (email: string) => string
  reauthCodeEntered: string
  reauthCodeExpired: string
  reauthProviderHint: string
  reauthProviderButton: (provider: string) => string
  reauthProviderNone: string
  reauthProviderDone: (provider: string) => string
  linkReauthHint: (provider: string) => string
  passwordNeedsEmail: string
  errorTooManyRefreshes: string
  emailChanged: string
  emailSendAgain: string
  emailPendingNote: string
  emailCodeExpired: string
  // 한 번 쓰는 링크 도착 화면(비밀번호 재설정 · 링크 로그인)
  /** 메일 링크 도착 화면의 「계속」 버튼 — 메일 스캐너가 대신 확정하지 못하게 사람이 누른다 */
  landingContinue: string
  /** 메일 링크 도착 화면의 「계속」 버튼 — 메일 스캐너가 대신 확정하지 못하게 사람이 누른다 */
  magicLinkTitle: string
  magicLinkChecking: string
  magicLinkInvalidTitle: string
  magicLinkInvalidBody: string
  magicLinkRequestNew: string
  magicLinkSentTitle: string
  methodsLoading: string
  methodsFailed: string
  methodsRetry: string
  // 비밀번호 찾기 · 재설정
  forgotTitle: string
  forgotSubtitle: string
  forgotSubmit: string
  forgotSentTitle: string
  forgotSentBody: (email: string) => string
  resetTitle: string
  resetSubtitle: string
  resetSubmit: string
  resetDoneTitle: string
  resetDoneBody: string
  resetInvalidTitle: string
  resetInvalidBody: string
  resetRequestNew: string
  backToSignIn: string
  // 소셜 콜백
  callbackChecking: string
  callbackFailedTitle: string
  callbackFailedBody: string
  callbackConflictTitle: string
  /** 같은 이메일의 계정이 이미 있다(`409 ACCOUNT.SOCIAL_EMAIL_CONFLICT`) — 제공자 이름 뒤에 조사를 붙이지 않는 문장 구조로 쓴다 */
  callbackConflictBody: (providerName: string) => string
  callbackConflictSignIn: string
  callbackConflictHome: string
  /** 제공자를 알 수 없을 때 `callbackConflictBody` 의 이름 자리에 */
  callbackConflictUnknownProvider: string
  /** 로그인 수단 구역의 이어 주기 줄 — 그 제공자의 「연결」 단추가 바로 아래 강조된다 */
  methodLinkContinue: (providerName: string) => string
  callbackCancelledTitle: string
  callbackCancelledBody: string
  /** state 가 이 탭에 없다 — 다른 탭 · 브라우저가 시작했거나 이미 쓰였거나 오래됐다 */
  callbackStateBody: string
  // 정지 · 차단
  suspendedTitle: string
  suspendedBody: string
  blockedTitle: string
  blockedBody: string
  contactSupport: string
  // 설정
  settingsTitle: string
  settingsIndexLabel: string
  sectionProfile: string
  sectionPassword: string
  sectionEmail: string
  sectionMethods: string
  sectionSessions: string
  sectionDelete: string
  profileLocale: string
  profileTimeZone: string
  profileLocaleDefault: string
  profileSaved: string
  passwordChangeSubmit: string
  passwordSetTitle: string
  passwordSetHint: string
  passwordChanged: string
  passwordOtherSessionsNote: string
  emailCurrent: string
  emailVerified: string
  emailUnverified: string
  emailNew: string
  emailChangeSubmit: string
  /** 주소가 없는 계정(LINE · X …)의 이메일 절 */
  emailNone: string
  emailAddHint: string
  /** 주소 없는 소셜 계정이 먼저 제공자로 본인 확인을 해야 하는 앱 — 주소 단계 앞에 확인이 있다 */
  emailAddHintReauth: string
  emailAddSubmit: string
  emailPendingTitle: string
  emailPendingBody: (email: string, until?: string) => string
  /** 같은 안내 — 주소가 한 번도 없던 계정의 **첫 등록**(「바뀌어요」가 아니라 「등록돼요」) */
  emailPendingBodyFirst: (email: string, until?: string) => string
  /** 계정 이메일 구역의 쓰임 한 줄 */
  emailRole: string
  /** 이메일을 필수로 켠 앱에서 — 지울 수 없다 */
  emailCannotRemove: string
  /** 인증번호가 안 올 때(남이 이미 쓰는 주소일 수 있다) — 첫 이메일 등록의 인증번호 화면. `provider` 는 이 계정이 로그인에 쓰는 제공자 이름 */
  emailNoCodeHint: (provider: string) => string
  /** 제공자를 모를 때의 같은 안내 */
  emailNoCodeHintPlain: string
  /** 첫 이메일 등록이 다시 인증을 요구했다(마지막 로그인 1시간 초과) */
  emailReauthNeeded: (provider: string) => string
  // 이메일 등록 강제 화면
  emailRequiredTitle: string
  emailRequiredBody: string
  emailRequiredField: string
  emailRequiredSend: string
  /** 쓸 수 있는 제공자가 없어 재동의를 못 할 때 - 처음 단계로 돌아가 다시 시도 */
  emailRequiredRetry: string
  emailRequiredCodeTitle: string
  emailRequiredCodeBody: (email: string) => string
  emailRequiredFixAddress: string
  emailRequiredSignOut: string
  /** 「이미 계정이 있나요?」 - 이 주소로 이미 가입한 계정이 있을 때 지금 만든 빈 계정을 지우고 그 계정으로 로그인하는 길(`POST /account/discard`) */
  emailRequiredDiscardTitle: string
  /** 제공자 이름을 모르면 undefined */
  emailRequiredDiscardBody: (provider?: string) => string
  emailRequiredDiscard: string
  emailRequiredDiscardConfirmTitle: string
  emailRequiredDiscardConfirmBody: string
  emailRequiredDiscardConfirm: string
  errorDiscardNotAllowed: string
  /** 계정 설정을 이메일 등록 전에 열었다 */
  emailRequiredSettingsNotice: string
  // 로그인 아이디(비공개 · 바꿀 수 없다) - 켠 서버에서만 쓰인다
  loginId: string
  /** 칸 아래 안내 - 서버가 알려 준 길이 범위 */
  loginIdHint: (min: number, max: number) => string
  problemLoginIdMissing: string
  problemLoginIdSize: (min: number, max: number) => string
  problemLoginIdChars: string
  problemLoginIdSymbols: string
  problemLoginIdDigitsOnly: string
  /** 실시간 확인의 상태 줄 */
  loginIdChecking: string
  loginIdAvailable: string
  /** 대문자를 넣었을 때 덧붙인다 - 저장될 모양(`sumin.kim`) */
  loginIdSavedAs: (id: string) => string
  errorLoginIdTaken: string
  loginIdCheckUnknown: string
  /** 가입 인증번호 단계에서 아이디가 겹쳤을 때, 그 자리에서 아이디만 다시 받는 칸 */
  loginIdRetryHint: string
  // 로그인 · 아이디 찾기
  signInIdentifier: string
  problemIdentifierMissing: string
  forgotLoginIdLink: string
  forgotLoginIdTitle: string
  forgotLoginIdSubtitle: string
  forgotLoginIdSubmit: string
  forgotLoginIdSentBody: (email: string) => string
  // 아이디 게이트 · 확인 대화상자
  loginIdRequiredTitle: string
  loginIdRequiredBody: string
  loginIdRequiredSubmit: string
  loginIdConfirmTitle: (id: string) => string
  loginIdConfirmBody: string
  loginIdConfirm: string
  loginIdConfirmBack: string
  /** 아이디 게이트의 밑줄 링크 - 계정 설정(`/account`)으로 간다(막이 걷힌다) */
  loginIdRequiredSettings: string
  // 설정
  settingsLoginIdFixed: string
  settingsLoginIdNoPassword: (provider: string) => string
  settingsLoginIdSetPassword: string
  settingsLoginIdAddEmail: string
  settingsEmailToWrite: string
  // 이메일을 받는 시점 - "쓰기 때"
  emailRequiredWriteTitle: string
  emailRequiredWriteBody: string
  emailRequiredLater: string
  emailRequiredWriteNotice: string
  emailRequiredWriteNoticeAction: string
  emailRequiredDeclined: string
  emailRequiredReauthLosesDraft: (provider: string) => string
  /** 버리기 확인 문구에 아이디가 있을 때 덧붙인다 */
  emailRequiredDiscardConfirmLoginId: (id: string) => string
  // 연락받을 이메일
  sectionContactEmail: string
  contactEmailRole: string
  contactEmailNone: string
  contactEmailCurrent: string
  contactEmailAdd: string
  contactEmailChange: string
  contactEmailRemove: string
  contactEmailField: string
  contactEmailSend: string
  contactEmailCodeTitle: string
  contactEmailCodeBody: (email: string) => string
  contactEmailSaved: string
  contactEmailRemoved: string
  contactEmailCurrentIsAccount: string
  methodsDescription: string
  methodsLastProtected: string
  methodNames: Record<string, string>
  methodLastUsed: (when: string) => string
  methodNeverUsed: string
  methodUnlink: string
  methodLink: (provider: string) => string
  methodUnlinkTitle: (method: string) => string
  methodUnlinkBody: string
  methodUnlinked: string
  methodLinked: string
  methodLinkedNotice: (provider: string) => string
  sessionsDescription: string
  sessionsCurrent: string
  sessionsRevoke: string
  sessionsRevokeOthers: string
  /** 연락받을 이메일을 켠 앱 - 모든 기기 로그아웃이 그 주소도 비운다 */
  sessionsContactNote: string
  sessionsRevoked: string
  sessionsUnknownDevice: string
  /** IP 가 루프백일 때(개발 · 같은 컴퓨터) — 기기를 가리키는 말이 아니라 주소의 종류다 */
  sessionsLocalDevice: string
  sessionsLastUsed: (when: string) => string
  sessionsEmpty: string
  deleteTitle: string
  deleteGraceNotice: (days: number) => string
  deletePasswordHint: string
  deleteButton: string
  deleteDialogTitle: string
  deleteDialogBody: string
  deleteTypedPhrase: string
  deleteTypedLabel: string
  deleteConfirm: string
  deleteScheduled: (date: string) => string
  /** 삭제 예약 안내 아래 — 누르면 이 기기를 로그아웃한다 */
  deleteDoneAction: string
  /** 서버가 self-restore 를 켰다고 앱이 알려 줄 때(`selfRestore`)만 — 삭제 예약 안내 아래 */
  deleteSelfRestoreNote: string
  /** 삭제를 마친 직후의 로그아웃 상태 안내 화면 */
  accountDeletedTitle: string
  accountDeletedBody: (date: string | null) => string
  accountDeletedAction: string
  accountDeletedRestoreNote: string
  // 탈퇴 대기 중인 계정의 로그인(403 AUTH.ACCOUNT_DELETION_PENDING)
  deletionPendingTitle: string
  deletionPendingBody: (date: string | null) => string
  deletionCancelAction: string
  deletionLeaveAction: string
  deletionNoRestoreTitle: string
  deletionNoRestoreBody: (date: string | null) => string
  deletionExpiredTitle: string
  deletionExpiredBody: string
  // 관리자
  adminTitle: string
  adminSearch: string
  adminStatusFilter: string
  adminStatusAll: string
  adminColumns: Record<
    'email' | 'name' | 'status' | 'roles' | 'created' | 'lastLogin' | 'actions',
    string
  >
  adminStatus: Record<string, string>
  adminSuspend: string
  adminUnsuspend: string
  adminRestore: string
  adminGrantRole: (role: string) => string
  adminRevokeRole: (role: string) => string
  adminSuspendTitle: (email: string) => string
  adminSuspendReason: string
  adminEmpty: string
  adminCaption: string
  adminPage: (page: number, pages: number) => string
  adminPrevious: string
  adminNext: string
  adminPurgeAfter: (date: string) => string
}

const asDefault = <T extends AuthLabels>(value: T): T => value

export const defaultAuthLabels: AuthLabels = asDefault({
  email: 'Email',
  password: 'Password',
  newPassword: 'New password',
  currentPassword: 'Current password',
  displayName: 'Nickname',
  displayNameHint: 'This is the name other people see.',
  displayNameShownAs: 'Shown to others as',
  errorDisplayNameTaken: 'That nickname is already taken.',
  problemDisplayNamePattern: 'Characters like # and @ and invisible characters are not allowed',
  problemDisplayNameReserved: 'That nickname cannot be used',
  errorDisplayNameRateLimited: (wait) =>
    `You changed your nickname too often. Try again in ${wait}.`,
  durationHours: (n) => `${n} h`,
  durationMinutes: (n) => `${n} min`,
  durationSeconds: (n) => `${n} s`,
  nicknameRetryHint:
    'Pick another nickname, then confirm with the same code. You do not need to enter your password again.',
  nicknameRetryAction: 'Continue with this nickname',
  codeTimeUpNoResend: 'Time is up. Please start over.',
  codeNoMoreResends: 'This code cannot be sent again. When it expires, start over.',
  codeNoMoreResendsSignUp:
    'This code cannot be sent again. When it expires, please sign up again from the start.',
  errorErased: 'This account has already been erased.',
  errorErasureInProgress: 'This account is being erased. Repeat the erase to finish it.',
  errorErasureRetry: 'The erase did not finish. Repeat it to continue.',
  errorNotSuspended: 'Only suspended accounts can be erased.',
  problemDisplayNameMissing: 'Enter a nickname',
  problemDisplayNameTooLong: (max) => `Use 1 to ${max} characters`,
  or: 'or',
  back: 'Back',
  continue: 'Continue',
  submitting: 'Working',
  save: 'Save',
  saved: 'Saved',
  cancel: 'Cancel',
  copyHint: 'Copy',
  errorInvalidCredentials: 'The email or password is not correct.',
  errorEmailNotVerified:
    'This account has not finished email verification. Sign up again and enter the code we email you.',
  errorSuspended: 'This account is suspended.',
  errorDeletionPending: 'This account is being deleted.',
  errorSuspendedCannotDelete: 'A suspended account cannot be deleted.',
  errorRegistrationBlocked: 'You cannot sign up with this address (account).',
  errorBlocked: 'This account cannot be used.',
  errorTooManyAttempts: 'Too many attempts. Try again later.',
  errorRateLimited: 'Too many requests. Try again later.',
  errorRetryIn: (seconds) => `Try again in ${seconds} s.`,
  errorTokenInvalid: 'This link is invalid, expired or already used.',
  errorEmailTaken: 'That email is already registered.',
  errorSignUpClosed: 'Sign-up is closed right now.',
  errorCaptcha: 'The check did not pass. Try again.',
  errorCurrentPassword: 'The current password is not correct.',
  errorReauth: 'The confirmation did not pass. Try again.',
  errorReauthRequired: 'Please confirm it is you first.',
  errorLastMethod: 'This is your last sign-in method. Add another one first.',
  errorLastAdmin: 'There must be at least one administrator.',
  errorSelfAction: 'You cannot do that to your own account.',
  errorIdentityTaken:
    'This account is already linked to another account. Sign in with that account, unlink it in settings or delete that account, then try again.',
  errorIdentityTakenFor: (provider) =>
    `This ${provider} account is already linked to another account. Sign in with that ${provider} account, unlink it in settings or delete that account, then try again.`,
  errorIdentityExists: 'That sign-in method is already linked.',
  errorSocialConflict:
    'An account with that email already exists. Sign in with it, then link this provider in settings.',
  errorConsentRequired:
    'The agreements changed while you were signing up. Read the updated text and agree again.',
  errorSocialRequest: 'The sign-in could not be started securely. Reload the page and try again.',
  errorSocialCode: 'This sign-in expired or was already used. Start it again.',
  errorSocialGateway: 'The provider is not answering right now. Try again in a moment.',
  errorPkceUnavailable:
    'This browser cannot start a secure sign-in with this provider. Open the site over https (or on localhost) in an up-to-date browser.',
  errorValidation: 'Check the highlighted fields.',
  errorNetwork: 'No connection. Try again.',
  errorGeneric: 'Something went wrong. Try again.',
  errorReference: (traceId) => `Reference: ${traceId}`,
  sessionEnded: {
    expired: 'Your session expired. Sign in again.',
    'reuse-detected': 'You were signed out because your session was used elsewhere. Sign in again.',
    suspended: 'This account is suspended.',
    unauthenticated: 'Sign in to continue.',
  },
  passwordRequirementsTitle: 'Your password needs',
  passwordStrengthLabel: 'Strength',
  passwordStrength: ['Empty', 'Weak', 'Fair', 'Good', 'Strong'],
  passwordRule: {
    TOO_SHORT: 'Enough characters',
    TOO_LONG: 'Not too long',
    NEEDS_LETTER: 'A letter',
    NEEDS_DIGIT: 'A digit',
    NEEDS_SYMBOL: 'A symbol',
    CONTAINS_EMAIL: 'Not part of your email',
    TOO_COMMON: 'Not a common password',
    BREACHED: 'Not in a known data breach',
  },
  requirementMet: 'met',
  requirementUnmet: 'not met yet',
  show: 'Show',
  hide: 'Hide',
  passwordConfirm: 'Confirm password',
  passwordMismatch: 'Passwords do not match',
  passwordConfirmMissing: 'Enter the password again to confirm it',
  passwordMatches: 'Passwords match',
  formProblemsTitle: 'Please check the following',
  problemEmailMissing: 'Enter your email address',
  problemEmailInvalid: 'Enter a valid email address',
  problemPasswordMissing: 'Enter your password',
  problemPasswordRules: 'Meet all the password rules',
  problemConsentMissing: 'Agree to the required terms',
  problemProofMissing: 'Confirm it is you first (see above)',
  signInTitle: 'Sign in',
  signInSubtitle: 'Welcome back.',
  signInSubmit: 'Sign in',
  signInForgot: 'Forgot your password?',
  signInNoAccount: 'No account yet?',
  signInCreateAccount: 'Create one',
  signInWithProvider: (provider) => `Continue with ${provider}`,
  signInMagicLink: 'Email me a sign-in link',
  signInMagicLinkHelp: 'We email you a link. No password needed.',
  signInMagicLinkSubmit: 'Send the link',
  signInUsePassword: 'Use a password instead',
  providerNames: { google: 'Google', line: 'LINE', x: 'X', kakao: 'Kakao', naver: 'Naver' },
  providerSignInText: {},
  signUpTitle: 'Create your account',
  signUpSubtitle: 'It takes a minute.',
  signUpSubmit: 'Create account',
  signUpHaveAccount: 'Already have an account?',
  signUpSignIn: 'Sign in',
  signUpClosedTitle: 'Sign-up is closed',
  signUpConsentRequired: 'Required',
  signUpCaptcha: 'Security check',
  codeTitle: 'Enter the 6-digit code',
  codeBody: (email) =>
    `We sent a 6-digit code to ${email}. Enter it before the time runs out — never tell it to anyone.`,
  codeGroupLabel: 'Verification code',
  codeDigit: (position, total) => `Digit ${position} of ${total}`,
  codeInvalid: (left) =>
    left === undefined
      ? 'That code is not right.'
      : `That code is not right. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`,
  codeExpired: 'This code has expired or was used up. Start over to get a new one.',
  codeRestart: 'Start over',
  codeResend: 'Send a new code',
  codeResent: 'A new code is on its way.',
  codeResendIn: (seconds) => `You can ask again in ${seconds} s`,
  codeResendWaiting: (seconds) => `Send a new code (${seconds} s)`,
  codeTimeLeft: (clock) => `Time left ${clock}`,
  codeTimeMinute: 'One minute left',
  codeTimeTen: '10 seconds left',
  codeTimeUp: 'Time is up. Please get a new code.',
  codeChecking: 'Checking the code',
  checkEmailTitle: 'Check your email',
  checkEmailBody: (email) => `We sent a link to ${email}. Open it to continue.`,
  checkEmailSpam: 'Nothing yet? Look in your spam folder.',
  checkEmailResend: 'Send it again',
  checkEmailResent: 'Sent again.',
  checkEmailResendIn: (seconds) => `Send again in ${seconds} s`,
  checkEmailWrongAddress: 'Wrong address? Start over',
  landingContinue: 'Continue',
  legacyLinkTitle: 'This link is no longer used',
  legacyLinkBody:
    'Verifying an email, changing it, confirming it is you and deleting an account now work with a 6-digit code instead of a link. Start the action again — sign up, or open your account settings — and we email you a code.',
  legacyLinkAction: 'Go to sign in',
  reauthTitle: 'Confirm it is you',
  reauthCodeHint: (email) => `To confirm it is you we email a 6-digit code to ${email}.`,
  reauthCodeSend: 'Email me a code',
  reauthCodeSent: (email) =>
    `We sent a 6-digit code to ${email}. Enter it before the time runs out — never tell it to anyone.`,
  reauthCodeEntered: 'Code entered — finish below.',
  reauthCodeExpired: 'This code has expired or was used up. Ask for a new one.',
  reauthProviderHint:
    'Your account has no email address, so confirm it is you with a sign-in method you already use. You come back here afterwards.',
  reauthProviderButton: (provider) => `Confirm with ${provider}`,
  reauthProviderNone: 'None of your sign-in methods can confirm it is you. Contact support.',
  reauthProviderDone: (provider) => `Confirmed with ${provider}.`,
  linkReauthHint: (provider) => `Confirm it is you to connect ${provider} to your account.`,
  passwordNeedsEmail:
    'A password needs a verified email address on the account, and this one has none.',
  errorTooManyRefreshes:
    'Your session is fine, but it was refreshed too often. Try again in a moment.',
  emailChanged: 'Your email address is changed. Your other devices were signed out.',
  emailSendAgain: 'Send the code again',
  emailPendingNote:
    'The code is sent to the new address only — nothing changes until you enter it.',
  emailCodeExpired: 'This code has expired or was used up. Request a new one.',
  magicLinkTitle: 'Signing you in',
  magicLinkChecking: 'Checking your link',
  magicLinkInvalidTitle: 'This sign-in link does not work',
  magicLinkInvalidBody: 'It may have expired or already been used. Request a new one.',
  magicLinkRequestNew: 'Request a new link',
  magicLinkSentTitle: 'Check your email',
  methodsLoading: 'Checking how you can sign in',
  methodsFailed:
    'We could not check which sign-in methods are available. Showing the default — try again if something is missing.',
  methodsRetry: 'Try again',
  forgotTitle: 'Reset your password',
  forgotSubtitle: 'Enter your email and we send a reset link.',
  forgotSubmit: 'Send the link',
  forgotSentTitle: 'Check your email',
  forgotSentBody: (email) => `If ${email} has an account, a reset link is on its way.`,
  resetTitle: 'Choose a new password',
  resetSubtitle: 'You will be signed out everywhere.',
  resetSubmit: 'Set the password',
  resetDoneTitle: 'Password changed',
  resetDoneBody: 'Sign in with your new password.',
  resetInvalidTitle: 'This link does not work',
  resetInvalidBody: 'It may have expired or already been used. Request a new one.',
  resetRequestNew: 'Request a new link',
  backToSignIn: 'Back to sign in',
  callbackChecking: 'Finishing sign-in',
  callbackFailedTitle: 'Sign-in did not finish',
  callbackFailedBody: 'The provider did not confirm the sign-in. Try again.',
  callbackConflictTitle: 'An account with this email already exists',
  callbackConflictBody: (name) =>
    `Sign in the way you signed up (email and password, an email link, or another social account), then press "Link ${name}" under "Sign-in methods" in your account settings. After that you can sign in with ${name} too.`,
  callbackConflictSignIn: 'Go to sign in',
  callbackConflictHome: 'Back to start',
  callbackConflictUnknownProvider: 'this social account',
  methodLinkContinue: (name) => `Continue linking ${name}`,
  callbackCancelledTitle: 'Sign-in cancelled',
  callbackCancelledBody:
    'You cancelled at the provider, so nothing changed. Start again whenever you like.',
  callbackStateBody:
    'This sign-in was not started in this browser tab (or it already finished). Start again from the sign-in page, and finish it in the same tab.',
  suspendedTitle: 'Account suspended',
  suspendedBody: 'This account is suspended. Contact support if you think this is a mistake.',
  blockedTitle: 'Access blocked',
  blockedBody: 'You are not allowed to use this page.',
  contactSupport: 'Contact support',
  settingsTitle: 'Account',
  settingsIndexLabel: 'Account sections',
  sectionProfile: 'Profile',
  sectionPassword: 'Password',
  sectionEmail: 'Account email',
  sectionMethods: 'Sign-in methods',
  sectionSessions: 'Active sessions',
  sectionDelete: 'Delete account',
  profileLocale: 'Language',
  profileTimeZone: 'Time zone',
  profileLocaleDefault: 'Not set',
  profileSaved: 'Profile saved.',
  passwordChangeSubmit: 'Change password',
  passwordSetTitle: 'Set a password',
  passwordSetHint: 'You sign in without a password today. You can add one.',
  passwordChanged: 'Password changed. Your other devices were signed out.',
  passwordOtherSessionsNote: 'Changing it signs out your other devices.',
  emailCurrent: 'Current address',
  emailVerified: 'Verified',
  emailUnverified: 'Not verified',
  emailNew: 'New email',
  emailChangeSubmit: 'Change email',
  emailNone: 'No email address on this account',
  emailAddHint:
    'Add one to get account notices and to recover access. Type it below and we send you a code.',
  emailAddHintReauth:
    'Add one to get account notices and to recover access. Type it below, confirm it is you with your current sign-in, and we send you a code.',
  emailAddSubmit: 'Add email',
  emailPendingTitle: 'Enter the code for your new address',
  emailPendingBody: (email, until) =>
    `We sent a 6-digit code to ${email}. Enter it here to switch your address${until ? ` (it works until ${until})` : ''}. No mail? Send the code again below.`,
  emailPendingBodyFirst: (email, until) =>
    `We sent a 6-digit code to ${email}. Enter it here to add this address${until ? ` (it works until ${until})` : ''}. No mail? Send the code again below.`,
  emailRole: 'Used to sign in, to find your password and for security notices.',
  emailCannotRemove:
    'An account always keeps one email address, so you can change it but not remove it.',
  emailNoCodeHint: (provider) =>
    `No code? An account may already exist for that address. Sign in to that account and link ${provider} in its settings.`,
  emailNoCodeHintPlain:
    'No code? An account may already exist for that address. Sign in to that account and link this sign-in method in its settings.',
  emailReauthNeeded: (provider) =>
    `For your security, confirm once more with ${provider}. You come back here afterwards.`,
  emailRequiredTitle: 'Add your email address',
  emailRequiredBody:
    'We use it when you need to get back into your account and for important notices. Nobody else can see it.',
  emailRequiredField: 'Email',
  emailRequiredSend: 'Send me a code',
  emailRequiredRetry: 'Try again',
  emailRequiredCodeTitle: 'Enter the code',
  emailRequiredCodeBody: (email) =>
    `We sent a 6-digit code to ${email}. Enter it before the time below runs out — never tell it to anyone.`,
  emailRequiredFixAddress: 'Fix the address',
  emailRequiredSignOut: 'Sign out',
  emailRequiredDiscardTitle: 'Already have an account?',
  emailRequiredDiscardBody: (provider) =>
    `If an account already exists for your address, delete this empty one, sign in to that account and link ${provider ?? 'this sign-in'} in its settings.`,
  emailRequiredDiscard: 'Delete this account and go to sign-in',
  emailRequiredDiscardConfirmTitle: 'Delete this account?',
  emailRequiredDiscardConfirmBody:
    'The account you just created is deleted right away - there is no grace period and it cannot be undone. You go to the sign-in page afterwards.',
  emailRequiredDiscardConfirm: 'Delete and go to sign-in',
  errorDiscardNotAllowed: 'This account cannot be discarded.',
  emailRequiredSettingsNotice:
    'Until you add an email address you can only add it here or delete your account.',
  loginId: 'Username',
  loginIdHint: (min, max) =>
    `Letters, numbers, periods, hyphens and underscores, ${min}–${max} characters. Capitals are saved as lowercase. Nobody else sees it, and it cannot be changed later.`,
  problemLoginIdMissing: 'Enter a username',
  problemLoginIdSize: (min, max) => `Use ${min} to ${max} characters`,
  problemLoginIdChars: 'Use only letters, numbers, periods, hyphens and underscores',
  problemLoginIdSymbols:
    'It cannot start or end with a symbol, and symbols cannot sit next to each other',
  problemLoginIdDigitsOnly: 'It cannot be numbers only — add a letter',
  loginIdChecking: 'Checking…',
  loginIdAvailable: 'This username is available',
  loginIdSavedAs: (id) => `It will be saved as ${id}`,
  errorLoginIdTaken: 'This username is taken or not available',
  loginIdCheckUnknown: "We can't check right now — it will be checked when you submit.",
  loginIdRetryHint:
    'Someone took this username meanwhile. Pick another one — you do not need a new code.',
  signInIdentifier: 'Username or email',
  problemIdentifierMissing: 'Enter your username or email',
  forgotLoginIdLink: 'Forgot your username?',
  forgotLoginIdTitle: 'Find your username',
  forgotLoginIdSubtitle: 'Enter your account email and we will send your username there.',
  forgotLoginIdSubmit: 'Send my username',
  forgotLoginIdSentBody: (email) => `If ${email} has an account, we have sent the username there.`,
  loginIdRequiredTitle: 'Choose your username',
  loginIdRequiredBody:
    'The name of your account that never changes — for signing in and for support. Nobody else sees it.',
  loginIdRequiredSubmit: 'Use this username',
  loginIdConfirmTitle: (id) => `Use ${id}?`,
  loginIdConfirmBody: 'You cannot change it afterwards.',
  loginIdConfirm: 'Confirm',
  loginIdConfirmBack: 'Edit',
  loginIdRequiredSettings: 'Account settings',
  settingsLoginIdFixed: 'Cannot be changed',
  settingsLoginIdNoPassword: (provider) =>
    `You sign in with ${provider} now. Set a password to sign in with your username or email too.`,
  settingsLoginIdSetPassword: 'Set a password',
  settingsLoginIdAddEmail: 'Register an email',
  settingsEmailToWrite: 'Register an email to start posting.',
  emailRequiredWriteTitle: 'Register an email to post',
  emailRequiredWriteBody:
    'You can keep reading. To post, comment or react you need an email. Nobody else sees it.',
  emailRequiredLater: 'Not now',
  emailRequiredWriteNotice: 'Register an email to start posting',
  emailRequiredWriteNoticeAction: 'Register email',
  emailRequiredDeclined: 'You can post after registering an email',
  emailRequiredReauthLosesDraft: (provider) =>
    `Going to ${provider} discards what you were writing.`,
  emailRequiredDiscardConfirmLoginId: (id) =>
    `The username ${id} goes with it and can never be used again.`,
  sectionContactEmail: 'Contact email',
  contactEmailRole:
    'Optional. Announcements and service notices come here. It is not used to sign in or to find your password. Resetting your password or signing out of all devices clears it - just add it again.',
  contactEmailNone: 'Notices go to your account email',
  contactEmailCurrent: 'Notices go to',
  contactEmailAdd: 'Add a contact email',
  contactEmailChange: 'Change',
  contactEmailRemove: 'Remove',
  contactEmailField: 'Contact email',
  contactEmailSend: 'Send me a code',
  contactEmailCodeTitle: 'Enter the code for your contact email',
  contactEmailCodeBody: (email) =>
    `We sent a 6-digit code to ${email}. Enter it before the time below runs out — never tell it to anyone.`,
  contactEmailSaved: 'Your contact email is saved.',
  contactEmailRemoved: 'Your contact email is removed. Notices go to your account email again.',
  contactEmailCurrentIsAccount: 'Security mail always goes to your account email.',
  methodsDescription: 'The ways you can sign in to this account.',
  methodsLastProtected: 'You need at least one way to sign in, so this one cannot be removed.',
  methodNames: { password: 'Password', magic_link: 'Email link' },
  methodLastUsed: (when) => `Last used ${when}`,
  methodNeverUsed: 'Not used yet',
  methodUnlink: 'Remove',
  methodLink: (provider) => `Link ${provider}`,
  methodUnlinkTitle: (method) => `Remove ${method}?`,
  methodUnlinkBody: 'You will no longer be able to sign in with it.',
  methodUnlinked: 'Removed.',
  methodLinkedNotice: (provider) =>
    `${provider} is linked. We sent a notice to your account address — if this was not you, change your password and sign out other devices.`,
  methodLinked: 'Linked.',
  sessionsDescription: 'Devices signed in to your account.',
  sessionsCurrent: 'This device',
  sessionsRevoke: 'Sign out',
  sessionsRevokeOthers: 'Sign out all other devices',
  sessionsContactNote:
    'Signing out of all devices also clears your contact email - add it again afterwards.',
  sessionsRevoked: 'Signed out.',
  sessionsUnknownDevice: 'Unknown device',
  sessionsLocalDevice: 'Local address',
  sessionsLastUsed: (when) => `Last active ${when}`,
  sessionsEmpty: 'No other sessions.',
  deleteTitle: 'Delete account',
  deleteGraceNotice: (days) =>
    `Your account is deleted at once and your data is erased after ${days} days. Within that time an administrator can still restore it.`,
  deletePasswordHint: 'Enter your password to confirm it is you.',
  deleteButton: 'Delete my account',
  deleteDialogTitle: 'Delete your account?',
  deleteDialogBody:
    'You are signed out everywhere, and your data is erased when the waiting period ends.',
  deleteTypedPhrase: 'DELETE',
  deleteTypedLabel: 'Type DELETE to confirm',
  deleteConfirm: 'Delete account',
  deleteScheduled: (date) => `Your account is scheduled for erasure on ${date}.`,
  deleteDoneAction: 'Sign out',
  deleteSelfRestoreNote: 'Sign in again within that time and you can cancel the deletion.',
  accountDeletedTitle: 'Your deletion request was received',
  accountDeletedBody: (date) =>
    date ? `Your data will be erased on ${date}.` : 'Your data will be erased soon.',
  accountDeletedAction: 'Go to sign in',
  accountDeletedRestoreNote: 'Sign in again before then and you can cancel it.',
  deletionPendingTitle: 'Cancel the deletion?',
  deletionPendingBody: (date) =>
    date
      ? `This account is being deleted. It is erased for good on ${date}.`
      : 'This account is being deleted. It is erased for good when the waiting period ends.',
  deletionCancelAction: 'Cancel the deletion and keep using it',
  deletionLeaveAction: 'Leave it as it is',
  deletionNoRestoreTitle: 'This account is being deleted',
  deletionNoRestoreBody: (date) =>
    `You cannot sign in because the account is being deleted. ${date ? `It is erased on ${date}. ` : ''}To undo it, please contact us.`,
  deletionExpiredTitle: 'Time ran out',
  deletionExpiredBody: 'Time ran out. Please sign in again.',
  adminTitle: 'Accounts',
  adminSearch: 'Search by email',
  adminStatusFilter: 'Status',
  adminStatusAll: 'All',
  adminColumns: {
    email: 'Email',
    name: 'Name',
    status: 'Status',
    roles: 'Roles',
    created: 'Created',
    lastLogin: 'Last sign-in',
    actions: 'Actions',
  },
  adminStatus: { ACTIVE: 'Active', SUSPENDED: 'Suspended', DELETED: 'Deleted' },
  adminSuspend: 'Suspend',
  adminUnsuspend: 'Unsuspend',
  adminRestore: 'Restore',
  adminGrantRole: (role) => `Grant ${role}`,
  adminRevokeRole: (role) => `Revoke ${role}`,
  adminSuspendTitle: (email) => `Suspend ${email}?`,
  adminSuspendReason: 'Reason (shown to nobody, kept for the record)',
  adminEmpty: 'No accounts match.',
  adminCaption: 'Accounts',
  adminPage: (page, pages) => `Page ${page} of ${pages}`,
  adminPrevious: 'Previous',
  adminNext: 'Next',
  adminPurgeAfter: (date) => `Erased on ${date}`,
})

/** 기본 영어 위에 앱이 준 문구를 덮는다 */
export function mergeLabels(labels?: Partial<AuthLabels>): AuthLabels {
  return labels ? { ...defaultAuthLabels, ...labels } : defaultAuthLabels
}
