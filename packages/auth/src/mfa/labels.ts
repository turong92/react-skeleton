/**
 * 2단계 인증 화면의 문구 - `AuthLabels` 의 한 덩어리(`AuthLabels = … & TwoFactorLabels`)라 앱이 따로 넘길 것은 없다.
 * 기본은 영어(`defaultTwoFactorLabels`), 한국어는 `koAuthLabels` 가 `koTwoFactorLabels` 를 품는다
 */
export type TwoFactorLabels = {
  // 로그인의 두 번째 단계
  mfaTitle: string
  mfaBody: string
  mfaRecoveryBody: string
  mfaCodeGroup: string
  mfaChecking: string
  mfaTimeLeft: (clock: string) => string
  mfaTimeMinute: string
  mfaTimeTen: string
  mfaTimeUp: string
  /** 틀린 코드 - `attemptsLeft` 를 알면 남은 시도를 말한다 */
  mfaCodeWrong: (attemptsLeft?: number) => string
  mfaUseRecovery: string
  mfaUseApp: string
  mfaRecoveryLabel: string
  mfaRecoverySubmit: string
  mfaRecoveryMissing: string
  mfaExpiredTitle: string
  mfaExpiredBody: string
  mfaBackToSignIn: string
  mfaTooManyAttempts: string
  // 설정의 한 줄
  sectionTwoFactor: string
  mfaOff: string
  mfaOn: string
  mfaOnSince: (date: string) => string
  mfaRecoveryRemaining: (count: number) => string
  mfaLowRecovery: string
  mfaRequiredNote: string
  mfaNotEnabled: string
  mfaLoadFailed: string
  mfaRetry: string
  mfaEnable: string
  mfaEnableAction: string
  mfaDisable: string
  mfaDisableAction: string
  mfaRegenerate: string
  mfaChangeApp: string
  // 켜기 마법사
  mfaReauthHint: string
  mfaContinue: string
  mfaScanBody: string
  mfaQrLabel: string
  mfaSecretHint: string
  mfaOpenInApp: string
  mfaConfirmBody: string
  mfaConfirmWrong: string
  mfaEnrollExpired: string
  mfaEnrollRestart: string
  mfaProviderReauthUnsupported: string
  mfaEnabledDone: string
  mfaAppChanged: string
  // 복구 코드
  mfaCodesTitle: string
  mfaCodesWarning: string
  mfaCodesCopy: string
  mfaCodesCopied: string
  mfaCodesCopyFailed: string
  mfaCodesDownload: string
  mfaCodesSaved: string
  mfaRegenerateBody: string
  mfaRegenerateSubmit: string
  mfaRegenerated: string
  // 끄기
  mfaDisableBody: string
  mfaDisableCodeLabel: string
  mfaDisableCodeMissing: string
  mfaDisabledDone: string
  mfaRequiredByPolicyError: string
}

export const defaultTwoFactorLabels: TwoFactorLabels = {
  mfaTitle: 'Two-step verification',
  mfaBody: 'Enter the 6-digit code from your authenticator app.',
  mfaRecoveryBody:
    'Enter one of the recovery codes you saved when you turned on two-step verification. Each code works once.',
  mfaCodeGroup: 'Authenticator code',
  mfaChecking: 'Checking the code',
  mfaTimeLeft: (clock) => `Time left ${clock}`,
  mfaTimeMinute: 'One minute left',
  mfaTimeTen: '10 seconds left',
  mfaTimeUp: 'Time is up. Sign in again.',
  mfaCodeWrong: (left) =>
    left === undefined
      ? 'That code is not right.'
      : `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`,
  mfaUseRecovery: 'Use a recovery code',
  mfaUseApp: 'Use an authenticator code',
  mfaRecoveryLabel: 'Recovery code',
  mfaRecoverySubmit: 'Verify',
  mfaRecoveryMissing: 'Enter a recovery code.',
  mfaExpiredTitle: 'Sign in again from the start',
  mfaExpiredBody:
    'The time ran out or all the tries were used. For your security the sign-in has to start over.',
  mfaBackToSignIn: 'Back to sign in',
  mfaTooManyAttempts: 'Too many wrong codes, so we paused two-step verification for a while.',
  sectionTwoFactor: 'Two-step verification',
  mfaOff: 'Off',
  mfaOn: 'On',
  mfaOnSince: (date) => `Turned on ${date}`,
  mfaRecoveryRemaining: (count) => `${count} recovery ${count === 1 ? 'code' : 'codes'} left`,
  mfaLowRecovery: 'You are almost out of recovery codes. Make new ones.',
  mfaRequiredNote: 'Two-step verification is required for this account.',
  mfaNotEnabled: 'The server has not turned on two-step verification.',
  mfaLoadFailed: 'Could not load the two-step verification status.',
  mfaRetry: 'Try again',
  mfaEnable: 'Turn on two-step verification',
  mfaEnableAction: 'Turn on',
  mfaDisable: 'Turn off two-step verification',
  mfaDisableAction: 'Turn off',
  mfaRegenerate: 'Make new recovery codes',
  mfaChangeApp: 'Change authenticator app',
  mfaReauthHint: 'Confirm it is you first.',
  mfaContinue: 'Continue',
  mfaScanBody: 'Scan this QR code with an authenticator app (1Password, Google Authenticator, …).',
  mfaQrLabel: 'QR code for the authenticator app',
  mfaSecretHint: 'Cannot scan it? Type this key into the app instead.',
  mfaOpenInApp: 'Open in the app',
  mfaConfirmBody: 'Then enter the 6-digit code the app shows.',
  mfaConfirmWrong: 'That code is not right. Check it and try again.',
  mfaEnrollExpired: 'Time ran out. Start again.',
  mfaEnrollRestart: 'Start again',
  mfaProviderReauthUnsupported:
    'Add a password or an email address first. Accounts that only sign in with a social provider cannot confirm it is them here yet.',
  mfaEnabledDone: 'Two-step verification is on.',
  mfaAppChanged: 'Your authenticator app was changed.',
  mfaCodesTitle: 'Save your recovery codes',
  mfaCodesWarning:
    'You can see these codes only now. If you lose your authenticator app, each one lets you in once. Keep them somewhere safe.',
  mfaCodesCopy: 'Copy',
  mfaCodesCopied: 'Copied',
  mfaCodesCopyFailed: 'Copy failed',
  mfaCodesDownload: 'Download',
  mfaCodesSaved: 'I saved them',
  mfaRegenerateBody: 'The old recovery codes stop working as soon as you make new ones.',
  mfaRegenerateSubmit: 'Make new recovery codes',
  mfaRegenerated: 'New recovery codes are ready. The old ones no longer work.',
  mfaDisableBody: 'Enter a code from your app, or a recovery code, to turn this off.',
  mfaDisableCodeLabel: 'Authenticator code or recovery code',
  mfaDisableCodeMissing: 'Enter an authenticator code or a recovery code.',
  mfaDisabledDone: 'Two-step verification is off.',
  mfaRequiredByPolicyError: 'This account must keep two-step verification on.',
}

export const koTwoFactorLabels: TwoFactorLabels = {
  mfaTitle: '2단계 인증',
  mfaBody: '인증 앱에 표시된 6자리 코드를 입력해 주세요.',
  mfaRecoveryBody:
    '2단계 인증을 켤 때 저장해 둔 복구 코드 중 하나를 입력해 주세요. 코드는 한 번만 쓸 수 있어요.',
  mfaCodeGroup: '인증 앱 코드',
  mfaChecking: '코드를 확인하는 중이에요',
  mfaTimeLeft: (clock) => `남은 시간 ${clock}`,
  mfaTimeMinute: '1분 남았어요',
  mfaTimeTen: '10초 남았어요',
  mfaTimeUp: '시간이 지났어요. 다시 로그인해 주세요.',
  mfaCodeWrong: (left) =>
    left === undefined ? '코드가 맞지 않아요.' : `코드가 맞지 않아요. 남은 시도 ${left}번`,
  mfaUseRecovery: '복구 코드로 들어가기',
  mfaUseApp: '인증 앱 코드로 들어가기',
  mfaRecoveryLabel: '복구 코드',
  mfaRecoverySubmit: '확인',
  mfaRecoveryMissing: '복구 코드를 입력해 주세요.',
  mfaExpiredTitle: '처음부터 다시 로그인해 주세요',
  mfaExpiredBody:
    '시간이 지났거나 시도 횟수를 모두 썼어요. 보안을 위해 로그인을 처음부터 다시 해야 해요.',
  mfaBackToSignIn: '로그인으로 돌아가기',
  mfaTooManyAttempts: '틀린 시도가 너무 많아 잠시 막았어요.',
  sectionTwoFactor: '2단계 인증',
  mfaOff: '꺼져 있어요',
  mfaOn: '켜져 있어요',
  mfaOnSince: (date) => `${date} 에 켰어요`,
  mfaRecoveryRemaining: (count) => `복구 코드 ${count}개 남았어요`,
  mfaLowRecovery: '복구 코드가 거의 없어요. 새로 만들어 두세요.',
  mfaRequiredNote: '이 계정은 2단계 인증이 필수예요.',
  mfaNotEnabled: '서버에서 2단계 인증을 켜지 않았어요.',
  mfaLoadFailed: '2단계 인증 상태를 불러오지 못했어요.',
  mfaRetry: '다시 시도',
  mfaEnable: '2단계 인증 켜기',
  mfaEnableAction: '켜기',
  mfaDisable: '2단계 인증 끄기',
  mfaDisableAction: '끄기',
  mfaRegenerate: '복구 코드 다시 만들기',
  mfaChangeApp: '인증 앱 바꾸기',
  mfaReauthHint: '먼저 본인인지 확인할게요.',
  mfaContinue: '계속',
  mfaScanBody: '인증 앱(1Password, Google Authenticator 등)으로 이 QR 코드를 스캔해 주세요.',
  mfaQrLabel: '인증 앱용 QR 코드',
  mfaSecretHint: '스캔할 수 없다면 이 키를 앱에 직접 입력해 주세요.',
  mfaOpenInApp: '앱에서 바로 열기',
  mfaConfirmBody: '그런 다음 앱에 표시된 6자리 코드를 입력해 주세요.',
  mfaConfirmWrong: '코드가 맞지 않아요. 다시 확인해 주세요.',
  mfaEnrollExpired: '시간이 지났어요. 처음부터 다시 해 주세요.',
  mfaEnrollRestart: '처음부터 다시',
  mfaProviderReauthUnsupported:
    '비밀번호나 이메일을 먼저 등록해 주세요. 소셜 로그인만 쓰는 계정은 아직 여기서 본인 확인을 할 수 없어요.',
  mfaEnabledDone: '2단계 인증을 켰어요.',
  mfaAppChanged: '인증 앱을 바꿨어요.',
  mfaCodesTitle: '복구 코드를 저장해 주세요',
  mfaCodesWarning:
    '이 코드는 지금만 볼 수 있어요. 인증 앱을 잃어버렸을 때 코드마다 한 번씩 들어올 수 있어요. 안전한 곳에 보관해 주세요.',
  mfaCodesCopy: '복사',
  mfaCodesCopied: '복사했어요',
  mfaCodesCopyFailed: '복사하지 못했어요',
  mfaCodesDownload: '내려받기',
  mfaCodesSaved: '저장했어요',
  mfaRegenerateBody: '새로 만들면 이전 복구 코드는 더 쓸 수 없어요.',
  mfaRegenerateSubmit: '새 복구 코드 만들기',
  mfaRegenerated: '새 복구 코드를 만들었어요. 이전 코드는 더 쓸 수 없어요.',
  mfaDisableBody: '끄려면 인증 앱 코드나 복구 코드를 입력해 주세요.',
  mfaDisableCodeLabel: '인증 앱 코드 또는 복구 코드',
  mfaDisableCodeMissing: '인증 앱 코드나 복구 코드를 입력해 주세요.',
  mfaDisabledDone: '2단계 인증을 껐어요.',
  mfaRequiredByPolicyError: '이 계정은 2단계 인증을 계속 켜 두어야 해요.',
}
