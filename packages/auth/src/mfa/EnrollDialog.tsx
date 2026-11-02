import { Alert, Button, CodeEntry, CopyButton, Dialog, Skeleton } from '@skeleton/ui'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { ReauthCredential, SocialReauth } from '../account/accountApi'
import { useCodeClock } from '../codeClockContext'
import { isReauthFailure, reauthKindOf, type ReauthSubject } from '../reauth/kind'
import { authErrorMessage } from '../screens/errors'
import type { AuthLabels } from '../screens/labels'
import { ReauthProof } from '../screens/ReauthProof'
import { useAction } from '../screens/useAction'
import { isMfaCodeWrong } from './errors'
import type { MfaApi } from './mfaApi'
import { downloadText, RECOVERY_CODES_FILE, recoveryCodesText } from './recoveryCodes'
import type { TotpEnrollment } from './types'
import styles from './TwoFactorSection.module.css'

export type DialogProps = {
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
  /** 소셜 전용 계정: 이 제공자의 동의 화면으로 보낸다 */
  onProvider?: (provider: string) => void
  /** 동의를 마치고 돌아왔다 - 본인 확인이 끝난 증거(한 번 쓰면 끝) */
  resume?: SocialReauth | null
  onResumeSpent?: () => void
}

/** 본인 확인(`ReauthProof`) + 이 단계의 일을 하는 단추 - 증거가 없으면 단추는 눌리고 이유를 말한다. 닫을 때마다 `key` 가 바뀌어 입력이 처음부터다 */
export function ReauthForm({
  subject,
  requestReauthCode,
  labels,
  givenLabels,
  onProvider,
  resume,
  onResumeSpent,
  intro,
  submitLabel,
  submitVariant,
  canRun,
  run,
  onCancel,
  children,
}: Pick<
  DialogProps,
  | 'subject'
  | 'requestReauthCode'
  | 'labels'
  | 'givenLabels'
  | 'onProvider'
  | 'resume'
  | 'onResumeSpent'
> & {
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

  if (kind === 'provider' && !onProvider && !resume)
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
    const credential: ReauthCredential | null = resume ? { socialReauth: resume } : proof
    if (!credential) return setMissing(true)
    setMissing(false)
    await action.run(() => run(credential))
    // 인가 코드는 한 번 쓰면 끝이다 - 결과가 어떻든 증거는 비운다(틀렸으면 제공자에 다시 다녀온다)
    if (resume) onResumeSpent?.()
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
        onProvider={onProvider}
        confirmedWith={resume?.provider}
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
export function RecoveryCodes({ codes, labels }: { codes: string[]; labels: AuthLabels }) {
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

/** 서버가 만든 QR 의 모듈 경로를 그대로 그린다 - 라이브러리 · `innerHTML` · data 주소 없이 `<path d>` 하나. 서버의 `size` 는 사방 4칸 여백을 포함한다(viewBox 는 `0 0 size size`) */
function QrCode({ size, path, label }: { size: number; path: string; label: string }) {
  return (
    <svg
      className={styles.qr}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}

/** 인증 앱 등록 - `enable`(처음) · `change`(앱 바꾸기: 복구 코드는 그대로라 마지막 단계가 없다) */
export function EnrollDialog({
  api,
  subject,
  requestReauthCode,
  labels,
  givenLabels,
  onProvider,
  resume,
  onResumeSpent,
  open,
  mode,
  onClose,
  onDone,
  startWithoutProof = false,
}: DialogProps & {
  mode: 'enable' | 'change'
  /**
   * 열자마자 본인 확인 없이(`{}`) 시작해 본다 - 2단계가 **필수**인 계정이 막 로그인했다면 서버가 증거 없이 받는다(로그인 15분 안).
   * 서버가 증거를 요구하면(`ACCOUNT.REAUTH_REQUIRED`) 평소 마법사의 본인 확인 단계로 간다
   */
  startWithoutProof?: boolean
}) {
  const now = useCodeClock()
  const [round, setRound] = useState(0)
  const [step, setStep] = useState<'reauth' | 'scan' | 'codes'>('reauth')
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const [trying, setTrying] = useState(false)
  const [startError, setStartError] = useState<string | undefined>(undefined)
  const roundRef = useRef(round)
  const triedRound = useRef(-1)
  const title = mode === 'change' ? labels.mfaChangeApp : labels.mfaEnable

  useEffect(() => {
    roundRef.current = round
  })
  // 증거 없이 먼저 시작해 본다(필수 문). 효과 정리로 응답을 버리지 않는다(StrictMode 가 효과를 두 번 돌려도 첫 응답이 살아야 한다) - 닫았다 열었으면(`round` 가 바뀜) 늦은 응답만 버린다
  useEffect(() => {
    if (!open || !startWithoutProof || step !== 'reauth' || triedRound.current === round) return
    triedRound.current = round
    const mine = round
    setTrying(true)
    setStartError(undefined)
    api.startEnrollment({}).then(
      (started) => {
        if (roundRef.current !== mine) return
        setEnrollment(started)
        setStep('scan')
        setTrying(false)
      },
      (error) => {
        if (roundRef.current !== mine) return
        if (!isReauthFailure(error)) setStartError(authErrorMessage(error, labels).message)
        setTrying(false)
      },
    )
  }, [open, startWithoutProof, step, round, api, labels])

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
    if (resume) onResumeSpent?.() // 닫으면 쓰지 않은 인가 코드도 버린다
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
      {!open ? null : step === 'reauth' && trying ? (
        <Skeleton />
      ) : step === 'reauth' ? (
        <ReauthForm
          key={round}
          subject={subject}
          requestReauthCode={requestReauthCode}
          labels={labels}
          givenLabels={givenLabels}
          onProvider={onProvider}
          resume={resume}
          onResumeSpent={onResumeSpent}
          intro={startError ?? labels.mfaReauthHint}
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
