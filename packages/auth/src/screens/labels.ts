import type { PasswordViolation } from '../account/types'

/**
 * 화면 문구. `@skeleton/auth` 는 번역을 모른다 — 모든 화면이 `labels?: Partial<AuthLabels>` 를 받고, 기본은 영어다.
 * 앱이 자기 i18n 으로 채워 넘긴다(`apps/sample/src/auth/authLabels.ts`). 값이 함수인 항목은 자리값이 낀 문장이다.
 */
export type AuthLabels = {
  // 공통
  email: string
  password: string
  newPassword: string
  currentPassword: string
  displayName: string
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
  errorLastMethod: string
  errorLastAdmin: string
  errorSelfAction: string
  errorIdentityTaken: string
  errorIdentityExists: string
  errorSocialConflict: string
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
  signInResendVerification: string
  signInVerificationResent: string
  providerNames: Record<string, string>
  // 가입
  signUpTitle: string
  signUpSubtitle: string
  signUpSubmit: string
  signUpHaveAccount: string
  signUpSignIn: string
  signUpClosedTitle: string
  signUpConsentRequired: string
  signUpCaptcha: string
  // 메일 확인 안내
  checkEmailTitle: string
  checkEmailBody: (email: string) => string
  checkEmailSpam: string
  checkEmailResend: string
  checkEmailResent: string
  checkEmailResendIn: (seconds: number) => string
  checkEmailWrongAddress: string
  // 한 번 쓰는 링크 도착 화면
  verifyEmailTitle: string
  verifyEmailChecking: string
  verifyEmailDone: string
  verifyEmailDoneAction: string
  verifyEmailInvalidTitle: string
  verifyEmailInvalidBody: string
  verifyEmailResendSubmit: string
  magicLinkTitle: string
  magicLinkChecking: string
  magicLinkInvalidTitle: string
  magicLinkInvalidBody: string
  magicLinkRequestNew: string
  magicLinkSentTitle: string
  confirmEmailChangeTitle: string
  confirmEmailChangeChecking: string
  confirmEmailChangeDone: string
  confirmEmailChangeInvalidBody: string
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
  callbackConflictBody: string
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
  emailPendingTitle: string
  emailPendingBody: (email: string) => string
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
  sessionsDescription: string
  sessionsCurrent: string
  sessionsRevoke: string
  sessionsRevokeOthers: string
  sessionsRevoked: string
  sessionsUnknownDevice: string
  sessionsLastUsed: (when: string) => string
  sessionsEmpty: string
  deleteTitle: string
  deleteGraceNotice: (days: number) => string
  deletePasswordHint: string
  deleteMailHint: string
  deleteMailSend: string
  deleteMailSent: string
  deleteTokenLabel: string
  deleteButton: string
  deleteDialogTitle: string
  deleteDialogBody: string
  deleteTypedPhrase: string
  deleteTypedLabel: string
  deleteConfirm: string
  deleteScheduled: (date: string) => string
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
  displayName: 'Display name',
  or: 'or',
  back: 'Back',
  continue: 'Continue',
  submitting: 'Working',
  save: 'Save',
  saved: 'Saved',
  cancel: 'Cancel',
  copyHint: 'Copy',
  errorInvalidCredentials: 'The email or password is not correct.',
  errorEmailNotVerified: 'Verify your email address first. We can send the link again.',
  errorSuspended: 'This account is suspended.',
  errorBlocked: 'This account cannot be used.',
  errorTooManyAttempts: 'Too many attempts. Try again later.',
  errorRateLimited: 'Too many requests. Try again later.',
  errorRetryIn: (seconds) => `Try again in ${seconds} s.`,
  errorTokenInvalid: 'This link is invalid, expired or already used.',
  errorEmailTaken: 'That email is already registered.',
  errorSignUpClosed: 'Sign-up is closed right now.',
  errorCaptcha: 'The check did not pass. Try again.',
  errorCurrentPassword: 'The current password is not correct.',
  errorReauth: 'The password or confirmation is not correct.',
  errorLastMethod: 'This is your last sign-in method. Add another one first.',
  errorLastAdmin: 'There must be at least one administrator.',
  errorSelfAction: 'You cannot do that to your own account.',
  errorIdentityTaken: 'That account is already linked to someone else.',
  errorIdentityExists: 'That sign-in method is already linked.',
  errorSocialConflict:
    'An account with that email already exists. Sign in with it, then link this provider in settings.',
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
  signInResendVerification: 'Resend the verification email',
  signInVerificationResent: 'If that address needs verification, a new email is on its way.',
  providerNames: { google: 'Google', kakao: 'Kakao', naver: 'Naver' },
  signUpTitle: 'Create your account',
  signUpSubtitle: 'It takes a minute.',
  signUpSubmit: 'Create account',
  signUpHaveAccount: 'Already have an account?',
  signUpSignIn: 'Sign in',
  signUpClosedTitle: 'Sign-up is closed',
  signUpConsentRequired: 'Required',
  signUpCaptcha: 'Security check',
  checkEmailTitle: 'Check your email',
  checkEmailBody: (email) => `We sent a link to ${email}. Open it to continue.`,
  checkEmailSpam: 'Nothing yet? Look in your spam folder.',
  checkEmailResend: 'Send it again',
  checkEmailResent: 'Sent again.',
  checkEmailResendIn: (seconds) => `Send again in ${seconds} s`,
  checkEmailWrongAddress: 'Wrong address? Start over',
  verifyEmailTitle: 'Verify your email',
  verifyEmailChecking: 'Checking your link',
  verifyEmailDone: 'Your email is verified. You can sign in now.',
  verifyEmailDoneAction: 'Go to sign in',
  verifyEmailInvalidTitle: 'This link does not work',
  verifyEmailInvalidBody:
    'It may have expired or already been used. Enter your email and we send a new one.',
  verifyEmailResendSubmit: 'Send a new link',
  magicLinkTitle: 'Signing you in',
  magicLinkChecking: 'Checking your link',
  magicLinkInvalidTitle: 'This sign-in link does not work',
  magicLinkInvalidBody: 'It may have expired or already been used. Request a new one.',
  magicLinkRequestNew: 'Request a new link',
  magicLinkSentTitle: 'Check your email',
  confirmEmailChangeTitle: 'Confirm your new email',
  confirmEmailChangeChecking: 'Confirming the change',
  confirmEmailChangeDone:
    'Your email address is changed. You were signed out everywhere; sign in again with the new address.',
  confirmEmailChangeInvalidBody: 'This link is invalid, expired or already used.',
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
  callbackConflictTitle: 'You already have an account',
  callbackConflictBody:
    'That email is already registered with another sign-in method. Sign in with it, then link this provider in your account settings.',
  suspendedTitle: 'Account suspended',
  suspendedBody: 'This account is suspended. Contact support if you think this is a mistake.',
  blockedTitle: 'Access blocked',
  blockedBody: 'You are not allowed to use this page.',
  contactSupport: 'Contact support',
  settingsTitle: 'Account',
  settingsIndexLabel: 'Account sections',
  sectionProfile: 'Profile',
  sectionPassword: 'Password',
  sectionEmail: 'Email address',
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
  emailPendingTitle: 'Confirm the change',
  emailPendingBody: (email) => `We sent a link to ${email}. Your address changes when you open it.`,
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
  methodLinked: 'Linked.',
  sessionsDescription: 'Devices signed in to your account.',
  sessionsCurrent: 'This device',
  sessionsRevoke: 'Sign out',
  sessionsRevokeOthers: 'Sign out all other devices',
  sessionsRevoked: 'Signed out.',
  sessionsUnknownDevice: 'Unknown device',
  sessionsLastUsed: (when) => `Last active ${when}`,
  sessionsEmpty: 'No other sessions.',
  deleteTitle: 'Delete account',
  deleteGraceNotice: (days) =>
    `Your account is deleted at once and your data is erased after ${days} days. Within that time an administrator can still restore it.`,
  deletePasswordHint: 'Enter your password to confirm it is you.',
  deleteMailHint: 'You sign in without a password, so we email you a confirmation link.',
  deleteMailSend: 'Email me the link',
  deleteMailSent: 'Link sent. Paste the code from the link below, or open the link.',
  deleteTokenLabel: 'Confirmation code',
  deleteButton: 'Delete my account',
  deleteDialogTitle: 'Delete your account?',
  deleteDialogBody: 'You are signed out everywhere. This cannot be undone by you.',
  deleteTypedPhrase: 'DELETE',
  deleteTypedLabel: 'Type DELETE to confirm',
  deleteConfirm: 'Delete account',
  deleteScheduled: (date) => `Your account is scheduled for erasure on ${date}.`,
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
