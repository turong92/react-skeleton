import { ApiRequestError } from '@skeleton/api-client'
import {
  Alert,
  Button,
  Field,
  FormProblems,
  Input,
  SectionCard,
  useSubmitAttempt,
} from '@skeleton/ui'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { CodeSent } from '../account/accountApi'
import { useCodeClock } from '../codeClockContext'
import { codeWindowOf, estimateCodeWindow, type CodeWindow } from '../codeWindow'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'
import { VerifyCodePanel } from './VerifyCodePanel'

export type ContactEmailSectionProps = {
  /** 확인된 연락받을 이메일(없으면 null) — `me.contactEmail` */
  contactEmail: string | null
  /** `POST /account/contact-email { email }` → 202. 인증번호가 그 주소로 간다(다시 인증 없음 · 남의 주소도 받는다) */
  onRequestCode: (email: string) => Promise<CodeSent>
  /** `POST /account/contact-email/confirm { code }` */
  onConfirmCode: (code: string) => Promise<unknown>
  /** `DELETE /account/contact-email` */
  onRemove: () => Promise<unknown>
  /** 등록 · 바꿈 · 지움이 끝났다 — 부모가 `me` 를 다시 읽는다 */
  onChanged?: () => void
  labels?: Partial<AuthLabels>
}

/** 서버가 이 기능을 껐다(404) */
const isNotFound = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.status === 404

const SHAPE = /^[^\s@]+@[^\s@]+$/
type Step = 'idle' | 'entering' | 'code'

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
  labels: given,
}: ContactEmailSectionProps) {
  const labels = mergeLabels(given)
  const uid = useId()
  const fieldId = `${uid}-email`
  const now = useCodeClock()
  const action = useAction(labels)
  const removal = useAction(labels)
  const attempt = useSubmitAttempt()
  const [step, setStep] = useState<Step>('idle')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [codeWin, setCodeWin] = useState<CodeWindow | null>(null)
  const [notice, setNotice] = useState<'saved' | 'removed' | null>(null)
  const [off, setOff] = useState(false)
  const actions = useRef<HTMLDivElement>(null)
  const codeBox = useRef<HTMLDivElement>(null)

  // 단계가 바뀌면 포커스가 사라지지 않게: 입력 단계는 주소 칸, 인증번호 단계는 첫 칸, 끝나면 이 구역의 첫 단추. 처음 그릴 때는 건드리지 않는다(같은 단계에서 효과가 다시 돌아도 마찬가지)
  const seenStep = useRef<Step>('idle')
  useEffect(() => {
    if (seenStep.current === step) return
    seenStep.current = step
    if (step === 'entering') document.getElementById(fieldId)?.focus()
    if (step === 'idle') actions.current?.querySelector<HTMLButtonElement>('button')?.focus()
    if (step === 'code')
      codeBox.current
        ?.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')
        ?.focus()
  }, [step, fieldId])

  if (off) return null

  const problem = !email.trim()
    ? labels.problemEmailMissing
    : !SHAPE.test(email.trim())
      ? labels.problemEmailInvalid
      : undefined

  async function send(event: FormEvent) {
    event.preventDefault()
    if (problem) return attempt.fail(fieldId)
    let response: CodeSent
    const ok = await action.run(async () => {
      try {
        response = await onRequestCode(email.trim())
      } catch (caught) {
        if (isNotFound(caught)) setOff(true) // 이 서버는 기능을 껐다
        throw caught
      }
    })
    if (ok) {
      setCodeWin(codeWindowOf(response!) ?? estimateCodeWindow(now(), { ttlSeconds: 600 }))
      setSentTo(email.trim())
      setStep('code')
      attempt.reset()
    }
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
    if (ok) {
      setNotice('removed')
      onChanged?.()
    }
  }

  return (
    <SectionCard id="contact" title={labels.sectionContactEmail}>
      <div className={styles.stack}>
        <p className={styles.muted}>{labels.contactEmailRole}</p>
        {notice && (
          <Alert tone="success">
            {notice === 'saved' ? labels.contactEmailSaved : labels.contactEmailRemoved}
          </Alert>
        )}
        {step === 'idle' && (
          <>
            <div className={styles.row}>
              {contactEmail ? (
                <>
                  <span className={styles.muted}>{labels.contactEmailCurrent}</span>
                  <strong>{contactEmail}</strong>
                </>
              ) : (
                <span>{labels.contactEmailNone}</span>
              )}
            </div>
            {contactEmail && <p className={styles.muted}>{labels.contactEmailCurrentIsAccount}</p>}
            {removal.error && <Alert tone="danger">{removal.error.message}</Alert>}
            <div className={styles.row} ref={actions}>
              {contactEmail ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setNotice(null)
                      setEmail('')
                      setStep('entering')
                    }}
                  >
                    {labels.contactEmailChange}
                  </Button>
                  <Button
                    variant="danger"
                    loading={removal.busy}
                    loadingLabel={labels.submitting}
                    onClick={() => void remove()}
                  >
                    {labels.contactEmailRemove}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setNotice(null)
                    setEmail('')
                    setStep('entering')
                  }}
                >
                  {labels.contactEmailAdd}
                </Button>
              )}
            </div>
          </>
        )}
        {step === 'entering' && (
          <form
            className={styles.form}
            onSubmit={send}
            noValidate
            aria-label={labels.contactEmailSend}
          >
            {action.error && <Alert tone="danger">{action.error.message}</Alert>}
            <Field
              id={fieldId}
              label={labels.contactEmailField}
              required
              error={attempt.attempted ? problem : undefined}
            >
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <FormProblems
              title={labels.formProblemsTitle}
              problems={
                attempt.attempted && problem
                  ? [{ key: 'email', message: problem, target: fieldId }]
                  : []
              }
            />
            <div className={styles.row}>
              <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
                {labels.contactEmailSend}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  action.clear()
                  setStep('idle')
                }}
              >
                {labels.cancel}
              </Button>
            </div>
          </form>
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
      </div>
    </SectionCard>
  )
}
