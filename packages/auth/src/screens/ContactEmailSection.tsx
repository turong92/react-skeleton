import { ApiRequestError, ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, ConfirmDialog, useSubmitAttempt } from '@skeleton/ui'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { CodeSent, SocialReauth } from '../account/accountApi'
import { useCodeClock } from '../codeClockContext'
import { codeWindowOf, estimateCodeWindow, type CodeWindow } from '../codeWindow'
import styles from './auth.module.css'
import { ReauthPrompt } from './EmailRequiredParts'
import { ContactEmailForm, ContactEmailSummary } from './ContactEmailParts'
import type { ContactEmailSectionProps, Step } from './contactEmailTypes'
import { SectionShell } from './SectionShell'
import { SettingsDialog } from './SettingsDialog'
import { useStepFocus } from './useStepFocus'
import { mergeLabels } from './labels'
import { useAction } from './useAction'
import { VerifyCodePanel } from './VerifyCodePanel'

/** 서버가 이 기능을 껐다(404) */
const isNotFound = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.status === 404

const SHAPE = /^[^\s@]+@[^\s@]+$/

/**
 * 연락받을 이메일 — 공지 · 서비스 알림을 받을 **선택** 주소. 로그인 · 비밀번호 찾기 · 보안 메일에는 쓰이지 않는다(그건 늘 계정 이메일).
 * 등록 · 바꾸기는 주소 → 그 주소로 간 6자리 인증번호(`VerifyCodePanel`) → 끝, 지우기는 바로. 서버가 이 기능을 끄면(404) 구역 자체를 그리지 않는다.
 */
export function ContactEmailSection({
  contactEmail,
  onRequestCode,
  onConfirmCode,
  onRemove,
  onChanged,
  providers = [],
  onProviderReauth,
  resume,
  row,
  labels: given,
}: ContactEmailSectionProps) {
  const labels = mergeLabels(given)
  const uid = useId()
  const fieldId = `${uid}-email`
  const now = useCodeClock()
  const action = useAction(labels)
  const removal = useAction(labels)
  const attempt = useSubmitAttempt()
  // 제공자 동의에서 돌아왔으면 같은 대화상자가 입력 단계로 다시 열려 있고(주소가 채워져 있다) 곧 인증번호 단계로 이어진다
  const [step, setStep] = useState<Step>(resume ? 'entering' : 'idle')
  const [email, setEmail] = useState(resume?.email ?? '')
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [codeWin, setCodeWin] = useState<CodeWindow | null>(null)
  const [notice, setNotice] = useState<'saved' | 'removed' | null>(null)
  const [off, setOff] = useState(false)
  /** 서버가 이 요청에 제공자 재동의를 요구했다(계정 이메일이 없는 계정) */
  const [reauth, setReauth] = useState(false)
  const actions = useRef<HTMLDivElement>(null)
  const codeBox = useRef<HTMLDivElement>(null)

  useStepFocus(step, fieldId, actions, codeBox)

  // 제공자 동의에서 돌아왔다 - 한 번만(StrictMode 의 두 번째 효과가 쓴 인가 코드를 다시 내지 않게) 증명을 실어 요청한다
  const resumed = useRef(false)
  useEffect(() => {
    if (!resume || resumed.current) return
    resumed.current = true
    void request(resume.email, { socialReauth: resume.socialReauth })
  })

  if (off) return null

  const problem = !email.trim()
    ? labels.problemEmailMissing
    : !SHAPE.test(email.trim())
      ? labels.problemEmailInvalid
      : undefined

  async function request(address: string, proof?: { socialReauth: SocialReauth }) {
    let response: CodeSent
    const ok = await action.run(async () => {
      try {
        response = await onRequestCode(address, proof)
      } catch (caught) {
        if (isNotFound(caught)) setOff(true) // 이 서버는 기능을 껐다
        if (isErrorCode(caught, ErrorCodes.ACCOUNT_REAUTH_REQUIRED)) setReauth(true)
        throw caught
      }
    })
    if (ok) {
      setReauth(false)
      setCodeWin(codeWindowOf(response!) ?? estimateCodeWindow(now(), { ttlSeconds: 600 }))
      setSentTo(address)
      setStep('code')
      attempt.reset()
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    if (problem) return attempt.fail(fieldId)
    await request(email.trim())
  }

  async function remove() {
    const ok = await removal.run(async () => {
      try {
        await onRemove()
      } catch (caught) {
        if (isNotFound(caught)) setOff(true)
        throw caught
      }
    })
    setConfirmingRemove(false)
    if (ok) {
      setNotice('removed')
      onChanged?.()
    }
  }

  const dialogTitle = contactEmail ? labels.contactEmailChange : labels.contactEmailAdd
  const closeDialog = () => {
    action.clear()
    setReauth(false)
    setStep('idle')
  }
  return (
    <SectionShell row={row} id="contact" title={labels.sectionContactEmail}>
      <ContactEmailSummary
        contactEmail={contactEmail}
        labels={labels}
        actions={actions}
        removal={removal}
        notice={
          notice && (
            <Alert tone="success">
              {notice === 'saved' ? labels.contactEmailSaved : labels.contactEmailRemoved}
            </Alert>
          )
        }
        onStart={() => {
          setNotice(null)
          setEmail('')
          setStep('entering')
        }}
        onRemove={() => setConfirmingRemove(true)}
        dialogs={
          <>
            <SettingsDialog
              open={step !== 'idle'}
              onClose={closeDialog}
              title={dialogTitle}
              closeLabel={labels.dialogClose}
            >
              {step === 'entering' && (
                <ContactEmailForm
                  intro={
                    <>
                      <p className={styles.muted}>{labels.contactEmailRole}</p>
                      {contactEmail && (
                        <p className={styles.muted}>{labels.contactEmailCurrentIsAccount}</p>
                      )}
                    </>
                  }
                  labels={labels}
                  fieldId={fieldId}
                  email={email}
                  onEmailChange={setEmail}
                  problem={problem}
                  attempted={attempt.attempted}
                  error={reauth ? null : action.error}
                  busy={action.busy}
                  extra={
                    reauth && (
                      <ReauthPrompt
                        labels={labels}
                        providers={providers}
                        canContinue={!!onProviderReauth && !problem}
                        onProvider={(provider) => onProviderReauth?.(provider, email.trim())}
                        onRetry={() => {
                          setReauth(false)
                          action.clear()
                        }}
                      />
                    )
                  }
                  onSubmit={send}
                  onCancel={closeDialog}
                />
              )}
              {step === 'code' && (
                <div ref={codeBox}>
                  <VerifyCodePanel
                    email={sentTo}
                    title={labels.contactEmailCodeTitle}
                    description={labels.contactEmailCodeBody(sentTo)}
                    labels={{ ...given, checkEmailWrongAddress: labels.emailRequiredFixAddress }}
                    expiresAt={codeWin?.expiresAt}
                    expirySource={codeWin?.source ?? 'estimate'}
                    resendAvailableAt={codeWin?.resendAvailableAt}
                    resendExhausted={codeWin?.resendExhausted === true}
                    onVerify={async (code) => {
                      await onConfirmCode(code)
                      setNotice('saved')
                      setStep('idle')
                      onChanged?.()
                    }}
                    onResend={() => onRequestCode(sentTo)}
                    onStartOver={() => {
                      setEmail(sentTo)
                      action.clear()
                      setStep('entering')
                    }}
                  />
                </div>
              )}
            </SettingsDialog>
            <ConfirmDialog
              open={confirmingRemove}
              onClose={() => setConfirmingRemove(false)}
              onConfirm={() => void remove()}
              title={labels.contactEmailRemoveTitle}
              description={labels.contactEmailRemoveBody}
              confirmLabel={labels.contactEmailRemove}
              cancelLabel={labels.cancel}
              closeLabel={labels.cancel}
              busy={removal.busy}
            />
          </>
        }
      />
    </SectionShell>
  )
}
