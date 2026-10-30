import {
  Alert,
  Button,
  CodeEntry,
  CopyButton,
  Dialog,
  Field,
  Input,
  SettingsRow,
  Skeleton,
} from '@skeleton/ui'
import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import type { ReauthCredential } from '../account/accountApi'
import { useCodeClock } from '../codeClockContext'
import { isReauthFailure, reauthKindOf, type ReauthSubject } from '../reauth/kind'
import { authErrorMessage } from '../screens/errors'
import { mergeLabels, type AuthLabels } from '../screens/labels'
import { ReauthProof } from '../screens/ReauthProof'
import { SectionShell } from '../screens/SectionShell'
import { useAction } from '../screens/useAction'
import { useResource } from '../screens/useResource'
import { isMfaCodeWrong, isMfaOff } from './errors'
import type { MfaApi } from './mfaApi'
import { downloadText, RECOVERY_CODES_FILE, recoveryCodesText } from './recoveryCodes'
import type { TotpEnrollment } from './types'
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
  /** 켜기 · 끄기 · 복구 코드 재발급이 끝났다 - 서버가 켤 때 다른 세션을 닫으므로 설정은 세션 목록을 다시 읽는다 */
  onChanged?: () => void
}

type DialogName = 'enable' | 'change' | 'regenerate' | 'disable'

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
  onChanged,
}: TwoFactorSectionProps) {
  const labels = mergeLabels(given)
  const status = useResource(useCallback(() => api.status(), [api]))
  const [dialog, setDialog] = useState<DialogName | null>(null)
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
              <EnrollDialog {...common} open={dialog === 'enable'} mode="enable" />
              <EnrollDialog {...common} open={dialog === 'change'} mode="change" />
              <RegenerateDialog {...common} open={dialog === 'regenerate'} />
              <DisableDialog {...common} open={dialog === 'disable'} />
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

type DialogProps = {
  api: MfaApi
  subject: ReauthSubject
  requestReauthCode?: () => Promise<unknown>
  labels: AuthLabels
  givenLabels?: Partial<AuthLabels>
  open: boolean
  /** 대화상자가 닫혔다(부모가 열림 상태를 접는다) */
  onClose: () => void
  /** 일이 끝났다 - 부모가 닫고 알린다 */
  onDone: (message: string) => void
}

/** 본인 확인(`ReauthProof`) + 이 단계의 일을 하는 단추 - 증거가 없으면 단추는 눌리고 이유를 말한다. 닫을 때마다 `key` 가 바뀌어 입력이 처음부터다 */
function ReauthForm({
  subject,
  requestReauthCode,
  labels,
  givenLabels,
  intro,
  submitLabel,
  submitVariant,
  canRun,
  run,
  onCancel,
  children,
}: Pick<DialogProps, 'subject' | 'requestReauthCode' | 'labels' | 'givenLabels'> & {
  intro: string
  submitLabel: string
  submitVariant?: 'primary' | 'danger'
  /** `false` 면 보내지 않는다(그 이유는 호출한 쪽이 이미 말했다) */
  canRun?: () => boolean
  run: (proof: ReauthCredential) => Promise<unknown>
  onCancel: () => void
  children?: ReactNode
}) {
  const action = useAction(labels)
  const [proof, setProof] = useState<ReauthCredential | null>(null)
  const [missing, setMissing] = useState(false)
  const kind = reauthKindOf(subject)
  const failure = isReauthFailure(action.raw) ? action.raw : undefined

  if (kind === 'provider')
    return (
      <div className={styles.stack}>
        <Alert tone="warning">{labels.mfaProviderReauthUnsupported}</Alert>
        <div>
          <Button variant="ghost" onClick={onCancel}>
            {labels.cancel}
          </Button>
        </div>
      </div>
    )

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (canRun && !canRun()) return
    if (!proof) return setMissing(true)
    setMissing(false)
    await action.run(() => run(proof))
  }

  return (
    <form className={styles.stack} onSubmit={submit} noValidate>
      <p className={styles.meta}>{intro}</p>
      {action.error && !failure && <Alert tone="danger">{action.error.message}</Alert>}
      <ReauthProof
        kind={kind}
        email={subject.email}
        providers={subject.providers}
        requestCode={requestReauthCode}
        onChange={(credential) => {
          setProof(credential)
          if (credential) setMissing(false)
        }}
        failure={failure}
        labels={givenLabels}
      />
      {missing && <Alert tone="danger">{labels.problemProofMissing}</Alert>}
      {children}
      <div className={styles.row}>
        <Button
          type="submit"
          variant={submitVariant}
          loading={action.busy}
          loadingLabel={labels.submitting}
        >
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={action.busy}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  )
}

/** 복구 코드 열 개 - 복사 · 내려받기. 한 번만 보이는 값이라 이 단계가 닫히면 호출한 쪽이 버린다 */
function RecoveryCodes({ codes, labels }: { codes: string[]; labels: AuthLabels }) {
  return (
    <div className={styles.stack}>
      <Alert tone="warning">{labels.mfaCodesWarning}</Alert>
      <ul className={styles.codes}>
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <div className={styles.row}>
        <CopyButton
          value={recoveryCodesText(codes)}
          label={labels.mfaCodesCopy}
          copiedLabel={labels.mfaCodesCopied}
          failedLabel={labels.mfaCodesCopyFailed}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => downloadText(RECOVERY_CODES_FILE, recoveryCodesText(codes))}
        >
          {labels.mfaCodesDownload}
        </Button>
      </div>
    </div>
  )
}

/** 서버가 만든 QR 의 모듈 경로를 그대로 그린다 - 라이브러리 · `innerHTML` · data 주소 없이 `<path d>` 하나. 가장자리 4칸 여백은 viewBox 가 만든다 */
function QrCode({ size, path, label }: { size: number; path: string; label: string }) {
  const pad = 4
  const box = size + pad * 2
  return (
    <svg
      className={styles.qr}
      viewBox={`${-pad} ${-pad} ${box} ${box}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x={-pad} y={-pad} width={box} height={box} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}

/** 인증 앱 등록 - `enable`(처음) · `change`(앱 바꾸기: 복구 코드는 그대로라 마지막 단계가 없다) */
function EnrollDialog({
  api,
  subject,
  requestReauthCode,
  labels,
  givenLabels,
  open,
  mode,
  onClose,
  onDone,
}: DialogProps & { mode: 'enable' | 'change' }) {
  const now = useCodeClock()
  const [round, setRound] = useState(0)
  const [step, setStep] = useState<'reauth' | 'scan' | 'codes'>('reauth')
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const title = mode === 'change' ? labels.mfaChangeApp : labels.mfaEnable

  /** 처음부터 - 비밀 문자열 · 복구 코드를 메모리에서 버린다 */
  function reset() {
    setStep('reauth')
    setEnrollment(null)
    setCodes(null)
    setConfirmError(undefined)
    setConfirming(false)
    setRound((n) => n + 1)
  }
  function close() {
    reset()
    onClose()
  }

  async function confirm(code: string) {
    if (confirming) return
    setConfirming(true)
    setConfirmError(undefined)
    try {
      const result = await api.confirmEnrollment(code)
      setEnrollment(null) // 비밀 문자열은 확인되는 순간 화면에서 버린다
      if (result.recoveryCodes && result.recoveryCodes.length > 0) {
        setCodes(result.recoveryCodes)
        setStep('codes')
      } else {
        onDone(mode === 'change' ? labels.mfaAppChanged : labels.mfaEnabledDone)
      }
    } catch (error) {
      setConfirmError(
        isMfaCodeWrong(error) ? labels.mfaConfirmWrong : authErrorMessage(error, labels).message,
      )
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={step === 'codes' ? labels.mfaCodesTitle : title}
      closeLabel={labels.dialogClose}
      dismissible={step !== 'codes'}
      footer={
        step === 'codes' ? (
          <Button onClick={() => onDone(labels.mfaEnabledDone)}>{labels.mfaCodesSaved}</Button>
        ) : undefined
      }
    >
      {!open ? null : step === 'reauth' ? (
        <ReauthForm
          key={round}
          subject={subject}
          requestReauthCode={requestReauthCode}
          labels={labels}
          givenLabels={givenLabels}
          intro={labels.mfaReauthHint}
          submitLabel={labels.mfaContinue}
          onCancel={close}
          run={async (proof) => {
            setEnrollment(await api.startEnrollment(proof))
            setStep('scan')
          }}
        />
      ) : step === 'scan' && enrollment ? (
        <div className={styles.stack}>
          <p>{labels.mfaScanBody}</p>
          <div className={styles.scan}>
            <QrCode size={enrollment.qr.size} path={enrollment.qr.path} label={labels.mfaQrLabel} />
            <p className={styles.meta}>{labels.mfaSecretHint}</p>
            <div className={styles.row}>
              <code className={styles.secret}>{enrollment.secret}</code>
              <CopyButton
                value={enrollment.secret}
                label={labels.mfaCodesCopy}
                copiedLabel={labels.mfaCodesCopied}
                failedLabel={labels.mfaCodesCopyFailed}
              />
            </div>
            {enrollment.otpauthUri.startsWith('otpauth://') && (
              <a className={styles.openInApp} href={enrollment.otpauthUri}>
                {labels.mfaOpenInApp}
              </a>
            )}
          </div>
          <p>{labels.mfaConfirmBody}</p>
          <CodeEntry
            label={labels.mfaCodeGroup}
            digitLabel={labels.codeDigit}
            onComplete={(code) => void confirm(code)}
            error={confirmError}
            busy={confirming}
            expiresAt={enrollment.expiresAt}
            expirySource="server"
            now={now}
            timeLabels={{
              remaining: labels.mfaTimeLeft,
              minuteLeft: labels.mfaTimeMinute,
              secondsLeft: () => labels.mfaTimeTen,
              expired: labels.mfaEnrollExpired,
            }}
            restart={{ label: labels.mfaEnrollRestart, onRestart: reset }}
          />
          <div>
            <Button variant="ghost" onClick={close}>
              {labels.cancel}
            </Button>
          </div>
        </div>
      ) : codes ? (
        <RecoveryCodes codes={codes} labels={labels} />
      ) : null}
    </Dialog>
  )
}

/** 복구 코드 다시 만들기 - 본인 확인만(코드는 필요 없다). 새 코드는 한 번만 보이고, 이전 코드는 그 순간 죽는다 */
function RegenerateDialog({
  api,
  subject,
  requestReauthCode,
  labels,
  givenLabels,
  open,
  onClose,
  onDone,
}: DialogProps) {
  const [round, setRound] = useState(0)
  const [codes, setCodes] = useState<string[] | null>(null)
  function close() {
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
  open,
  onClose,
  onDone,
}: DialogProps) {
  const [round, setRound] = useState(0)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>(undefined)
  function close() {
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
