import { Alert, Button, Dialog, Field, Input, SettingsRow, Skeleton } from '@skeleton/ui'
import { useCallback, useState } from 'react'
import type { ReauthSubject } from '../reauth/kind'
import type { SocialReauth } from '../account/accountApi'
import type { ProviderAction } from '../socialLink'
import { isReauthFailure } from '../reauth/kind'
import { mergeLabels, type AuthLabels } from '../screens/labels'
import { SectionShell } from '../screens/SectionShell'
import { useResource } from '../screens/useResource'
import { isMfaCodeWrong, isMfaOff } from './errors'
import { EnrollDialog, RecoveryCodes, ReauthForm, type DialogProps } from './EnrollDialog'
import type { MfaApi } from './mfaApi'
import styles from './TwoFactorSection.module.css'

export type TwoFactorSectionProps = {
  api: MfaApi
  /** 다시 인증의 종류를 고르는 `me` 의 부분(`reauthSubjectOf(me)`) */
  subject: ReauthSubject
  /** `POST /account/reauth/confirmation` - 비밀번호 없는 계정의 6자리 메일 */
  requestReauthCode?: () => Promise<unknown>
  formatDate?: (iso: string) => string
  /** 줄만 그린다(`AccountSettings` 의 카드 안) - 아니면 제목 있는 카드 한 장에 담는다 */
  row?: boolean
  labels?: Partial<AuthLabels>
  /**
   * 비밀번호도 이메일도 없는 계정(소셜 로그인만)의 본인 확인 - 이 제공자의 동의 화면으로 보낸다(앱이 `socialLinkFlow.start` 로 `action` 을 state 에 묶는다; `AccountSettings` 가 이어 준다).
   * 없으면 그 계정은 이 구역에서 일을 못 하고 안내만 본다
   */
  onProviderReauth?: (provider: string, action: ProviderAction) => void
  /** 동의를 마치고 돌아왔다 - 하려던 일(`mfa-*`)의 대화상자가 본인 확인이 끝난 단계로 다시 열린다. 인가 코드는 한 번 쓰면 끝이라 쓰고 나면 `onResumeSpent` */
  resume?: { action: ProviderAction; socialReauth: SocialReauth } | null
  onResumeSpent?: () => void
  /** 켜기 · 끄기 · 복구 코드 재발급이 끝났다 - 서버가 켤 때 다른 세션을 닫으므로 설정은 세션 목록을 다시 읽는다 */
  onChanged?: () => void
}

type DialogName = 'enable' | 'change' | 'regenerate' | 'disable'

const ACTION_OF: Record<DialogName, ProviderAction> = {
  enable: { kind: 'mfa-enable' },
  change: { kind: 'mfa-change' },
  regenerate: { kind: 'mfa-regenerate' },
  disable: { kind: 'mfa-disable' },
}
const dialogOf = (action: ProviderAction | undefined): DialogName | null =>
  (Object.keys(ACTION_OF) as DialogName[]).find((name) => ACTION_OF[name].kind === action?.kind) ??
  null

const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()
/** 복구 코드가 이만큼 이하로 남으면 새로 만들라고 권한다 */
const LOW_RECOVERY = 2

/**
 * 2단계 인증 줄(설정) - 상태(켜짐 · 꺼짐 · 남은 복구 코드)와 「켜기」 마법사(본인 확인 → QR + 비밀 문자열 + 앱에서 열기 → 6자리 확인 → 복구 코드),
 * 「복구 코드 다시 만들기」 · 「인증 앱 바꾸기」 · 「끄기」(본인 확인 + 코드). 복구 코드 단계는 「저장했어요」 전에는 닫히지 않는다.
 * **비밀 문자열 · 복구 코드는 이 구역의 메모리에만 있다** - 서버 상태 캐시에 두지 않고, 대화상자를 닫으면 버린다. 서버가 켜지지 않았으면(404) 안내만 그린다
 */
export function TwoFactorSection({
  api,
  subject,
  requestReauthCode,
  formatDate = defaultFormat,
  row,
  labels: given,
  onProviderReauth,
  resume,
  onResumeSpent,
  onChanged,
}: TwoFactorSectionProps) {
  const labels = mergeLabels(given)
  const status = useResource(useCallback(() => api.status(), [api]))
  const [dialog, setDialog] = useState<DialogName | null>(() => dialogOf(resume?.action))
  const [notice, setNotice] = useState<string | null>(null)
  const current = status.data

  function finish(message: string) {
    setDialog(null)
    setNotice(message)
    status.reload()
    onChanged?.()
  }
  const open = (name: DialogName) => {
    setNotice(null)
    setDialog(name)
  }
  const common = {
    api,
    subject,
    requestReauthCode,
    labels,
    givenLabels: given,
    onClose: () => setDialog(null),
    onDone: finish,
  }
  /** 이 대화상자가 쓸 제공자 왕복 - 하려던 일이 이 대화상자의 것일 때만 돌아온 증거를 쥔다 */
  const trip = (name: DialogName) => ({
    onProvider:
      onProviderReauth && ((provider: string) => onProviderReauth(provider, ACTION_OF[name])),
    resume: resume && dialogOf(resume.action) === name ? resume.socialReauth : null,
    onResumeSpent,
  })

  return (
    <SectionShell row={row} id="two-factor" title={labels.sectionTwoFactor}>
      {status.error !== null ? (
        isMfaOff(status.error) ? (
          <SettingsRow label={labels.sectionTwoFactor} value={labels.mfaNotEnabled} />
        ) : (
          <Alert
            tone="danger"
            action={
              <Button variant="secondary" size="sm" onClick={status.reload}>
                {labels.mfaRetry}
              </Button>
            }
          >
            {labels.mfaLoadFailed}
          </Alert>
        )
      ) : !current ? (
        <Skeleton />
      ) : (
        <SettingsRow
          label={labels.sectionTwoFactor}
          value={current.enabled ? labels.mfaOn : labels.mfaOff}
          action={
            <div className={styles.row}>
              {!current.enabled ? (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={labels.mfaEnable}
                  onClick={() => open('enable')}
                >
                  {labels.mfaEnableAction}
                </Button>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={() => open('regenerate')}>
                    {labels.mfaRegenerate}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => open('change')}>
                    {labels.mfaChangeApp}
                  </Button>
                  {!current.required && (
                    <Button
                      variant="danger"
                      size="sm"
                      aria-label={labels.mfaDisable}
                      onClick={() => open('disable')}
                    >
                      {labels.mfaDisableAction}
                    </Button>
                  )}
                </>
              )}
            </div>
          }
          dialogs={
            <>
              <EnrollDialog
                {...common}
                {...trip('enable')}
                open={dialog === 'enable'}
                mode="enable"
              />
              <EnrollDialog
                {...common}
                {...trip('change')}
                open={dialog === 'change'}
                mode="change"
              />
              <RegenerateDialog
                {...common}
                {...trip('regenerate')}
                open={dialog === 'regenerate'}
              />
              <DisableDialog {...common} {...trip('disable')} open={dialog === 'disable'} />
            </>
          }
        >
          <div className={styles.stack}>
            {current.enabled && (
              <>
                {current.enabledAt && (
                  <p className={styles.meta}>{labels.mfaOnSince(formatDate(current.enabledAt))}</p>
                )}
                <p className={styles.meta}>
                  {labels.mfaRecoveryRemaining(current.recoveryCodesRemaining)}
                </p>
                {current.recoveryCodesRemaining <= LOW_RECOVERY && (
                  <Alert tone="warning">{labels.mfaLowRecovery}</Alert>
                )}
              </>
            )}
            {current.required && <p className={styles.meta}>{labels.mfaRequiredNote}</p>}
            {notice && <Alert tone="success">{notice}</Alert>}
          </div>
        </SettingsRow>
      )}
    </SectionShell>
  )
}

/** 복구 코드 다시 만들기 - 본인 확인만(코드는 필요 없다). 새 코드는 한 번만 보이고, 이전 코드는 그 순간 죽는다 */
function RegenerateDialog({
  api,
  subject,
  requestReauthCode,
  labels,
  givenLabels,
  onProvider,
  resume,
  onResumeSpent,
  open,
  onClose,
  onDone,
}: DialogProps) {
  const [round, setRound] = useState(0)
  const [codes, setCodes] = useState<string[] | null>(null)
  function close() {
    if (resume) onResumeSpent?.() // 닫으면 쓰지 않은 인가 코드도 버린다
    setCodes(null)
    setRound((n) => n + 1)
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={close}
      title={codes ? labels.mfaCodesTitle : labels.mfaRegenerate}
      closeLabel={labels.dialogClose}
      dismissible={!codes}
      footer={
        codes ? (
          <Button onClick={() => onDone(labels.mfaRegenerated)}>{labels.mfaCodesSaved}</Button>
        ) : undefined
      }
    >
      {!open ? null : codes ? (
        <RecoveryCodes codes={codes} labels={labels} />
      ) : (
        <ReauthForm
          key={round}
          subject={subject}
          requestReauthCode={requestReauthCode}
          labels={labels}
          givenLabels={givenLabels}
          onProvider={onProvider}
          resume={resume}
          onResumeSpent={onResumeSpent}
          intro={labels.mfaRegenerateBody}
          submitLabel={labels.mfaRegenerateSubmit}
          onCancel={close}
          run={async (proof) => {
            setCodes((await api.regenerateRecoveryCodes(proof)).recoveryCodes)
          }}
        />
      )}
    </Dialog>
  )
}

const SIX_DIGITS = /^\d{6}$/

/** 끄기 - 본인 확인 + 인증 앱 코드(또는 복구 코드). 필수 대상은 서버가 409 로 막는다 */
function DisableDialog({
  api,
  subject,
  requestReauthCode,
  labels,
  givenLabels,
  onProvider,
  resume,
  onResumeSpent,
  open,
  onClose,
  onDone,
}: DialogProps) {
  const [round, setRound] = useState(0)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>(undefined)
  function close() {
    if (resume) onResumeSpent?.() // 닫으면 쓰지 않은 인가 코드도 버린다
    setCode('')
    setCodeError(undefined)
    setRound((n) => n + 1)
    onClose()
  }
  return (
    <Dialog open={open} onClose={close} title={labels.mfaDisable} closeLabel={labels.dialogClose}>
      {!open ? null : (
        <ReauthForm
          key={round}
          subject={subject}
          requestReauthCode={requestReauthCode}
          labels={labels}
          givenLabels={givenLabels}
          onProvider={onProvider}
          resume={resume}
          onResumeSpent={onResumeSpent}
          intro={labels.mfaDisableBody}
          submitLabel={labels.mfaDisableAction}
          submitVariant="danger"
          onCancel={close}
          canRun={() => {
            if (code.trim() !== '') return true
            setCodeError(labels.mfaDisableCodeMissing)
            return false
          }}
          run={async (proof) => {
            const typed = code.replace(/\s+/g, '')
            setCodeError(undefined)
            try {
              await api.disable(
                SIX_DIGITS.test(typed)
                  ? { ...proof, code: typed }
                  : { ...proof, recoveryCode: code.trim() },
              )
            } catch (error) {
              // 틀린 본인 확인은 확인 입력이 말한다 - 여기서는 코드가 틀린 것만 이 칸 아래에서 말한다
              if (!isReauthFailure(error) && isMfaCodeWrong(error))
                return setCodeError(labels.mfaConfirmWrong)
              throw error
            }
            onDone(labels.mfaDisabledDone)
          }}
        >
          <Field label={labels.mfaDisableCodeLabel} error={codeError}>
            {(control) => (
              <Input
                {...control}
                value={code}
                autoComplete="one-time-code"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(event) => setCode(event.target.value)}
              />
            )}
          </Field>
        </ReauthForm>
      )}
    </Dialog>
  )
}
