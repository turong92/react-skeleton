import {
  Alert,
  Badge,
  Button,
  Field,
  FormProblems,
  Input,
  SectionCard,
  useSubmitAttempt,
  type FormProblem,
} from '@skeleton/ui'
import { useId, useRef, useState, type FormEvent } from 'react'
import type { ReauthCredential } from '../account/accountApi'
import { useCodeClock } from '../codeClockContext'
import { codeWindowOf, estimateCodeWindow, type CodeWindow } from '../codeWindow'
import { reauthKindOf, isReauthFailure, type ReauthSubject } from '../reauth/kind'
import { ReauthProof } from './ReauthProof'
import { VerifyCodePanel } from './VerifyCodePanel'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type EmailSectionProps = {
  email: string | null
  verified: boolean
  /** 다시 인증의 종류를 고르는 `me` 의 부분(`reauthSubjectOf(me)`) */
  subject: ReauthSubject
  /** `POST /account/reauth/confirmation` — 비밀번호 없는 계정의 인증번호 메일 */
  requestReauthCode: () => Promise<unknown>
  /** 202 — **새 주소로** 6자리 인증번호가 갈 뿐 바로 바뀌지 않는다(`pendingEmail` 이 서버에 남는다) */
  onChangeEmail: (request: ReauthCredential & { newEmail: string }) => Promise<unknown>
  /** `POST /account/email/change/confirm {code}` — 요청한 그 세션에서만. 성공하면 주소가 바뀌고 다른 기기는 로그아웃된다 */
  onConfirmCode: (code: string) => Promise<unknown>
  /** 바뀐 뒤(부모가 `me` · 세션 목록을 다시 읽는다) */
  onConfirmed?: () => void
  /** 주소가 없는 계정: 이 제공자의 동의를 다시 거친다(하려던 작업은 부모가 state 에 묶는다) */
  onProviderReauth?: (provider: string, newEmail: string) => void
  /** 제공자 동의를 마치고 돌아왔다 — 부모가 이어서 보내는 새 주소 · 확인해 준 제공자 */
  resume?: { newEmail: string; provider: string } | null
  /** 서버가 알려 주는 대기 중 변경(`me.pendingEmail` · `pendingEmailExpiresAt`) — 새로고침 뒤에도 같은 상태를 그린다 */
  pendingEmail?: string | null
  pendingEmailExpiresAt?: string | null
  /** 서버가 만료 시각을 안 줄 때(방금 요청한 직후 `me` 가 다시 읽히기 전) 어림하는 유효 시간(초) — 백엔드 `email-change.ttl` 기본 10분 */
  codeTtlSeconds?: number
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleString()

/**
 * 이메일 절 — 바꿔 달라는 요청은 새 주소로 6자리 인증번호를 보낸다. 대기 상태는 서버(`me.pendingEmail`)가 말해 주므로 새로고침해도 남고,
 * 인증번호를 **이 화면에서** 입력하면 바뀐다. 요청에는 다시 인증(비밀번호 · 메일 인증번호 · 제공자 동의)이 든다.
 * 서버에는 대기 중 변경을 취소하는 길이 없다 — 「다시 받기 · 다른 주소로」는 새 요청이 이전 것을 대신하는 것이고, 안 쓰면 만료된다.
 */
export function EmailSection({
  email,
  verified,
  subject,
  requestReauthCode,
  onChangeEmail,
  onConfirmCode,
  onConfirmed,
  onProviderReauth,
  resume,
  pendingEmail,
  pendingEmailExpiresAt,
  codeTtlSeconds = 600,
  formatDate = defaultFormat,
  labels: given,
}: EmailSectionProps) {
  const labels = mergeLabels(given)
  const kind = reauthKindOf(subject)
  const [newEmail, setNewEmail] = useState(resume?.newEmail ?? '')
  const [proof, setProof] = useState<ReauthCredential | null>(null)
  /** 방금 보낸 요청의 새 주소 — 서버의 `me` 가 다시 읽히기 전에도 인증번호 단계를 바로 연다 */
  const [local, setLocal] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [changed, setChanged] = useState(false)
  const action = useAction(labels)
  const now = useCodeClock()
  /** 방금 보낸 요청의 유효 창(어림) — `me.pendingEmailExpiresAt`(서버 값)이 읽히면 그쪽이 이긴다 */
  const [localWindow, setLocalWindow] = useState<CodeWindow | null>(null)
  const againBox = useRef<HTMLDivElement | null>(null)
  const waiting = local ?? pendingEmail ?? null
  const serverExpiry =
    pendingEmailExpiresAt && pendingEmail === waiting ? pendingEmailExpiresAt : null
  const showCode = !!waiting && !editing
  const uid = useId()
  const ids = { email: `${uid}-email`, proof: `${uid}-proof` }
  const attempt = useSubmitAttempt()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (kind === 'provider') return
    // 버튼은 늘 눌린다 — 새 주소가 비었거나 본인 확인이 모자라면 이유를 말하고 그 칸으로 간다
    if (problems.length > 0) return attempt.fail(problems[0].target)
    let response: unknown
    const ok = await action.run(async () => {
      response = await onChangeEmail({ newEmail, ...proof })
    })
    if (ok) {
      setLocalWindow(
        codeWindowOf(response) ?? estimateCodeWindow(now(), { ttlSeconds: codeTtlSeconds }),
      )
      setLocal(newEmail)
      setNewEmail('')
      setProof(null)
      setEditing(false)
      setChanged(false)
      attempt.reset()
    }
  }

  const proofReady = kind === 'password' || kind === 'code' ? proof !== null : true
  const newEmailProblem = !newEmail.trim()
    ? labels.problemEmailMissing
    : !/^[^\s@]+@[^\s@]+$/.test(newEmail.trim())
      ? labels.problemEmailInvalid
      : undefined
  const problems: FormProblem[] = [
    ...(newEmailProblem ? [{ key: 'email', message: newEmailProblem, target: ids.email }] : []),
    ...(proofReady
      ? []
      : [{ key: 'proof', message: labels.problemProofMissing, target: ids.proof }]),
  ]
  return (
    <SectionCard id="email" title={labels.sectionEmail}>
      <div className={styles.stack}>
        <div className={styles.row}>
          {email ? (
            <>
              <span className={styles.muted}>{labels.emailCurrent}</span>
              <strong>{email}</strong>
              <Badge tone={verified ? 'success' : 'warning'}>
                {verified ? labels.emailVerified : labels.emailUnverified}
              </Badge>
            </>
          ) : (
            <span className={styles.muted}>{labels.emailNone}</span>
          )}
        </div>
        {!email && !showCode && <p className={styles.muted}>{labels.emailAddHint}</p>}
        {changed && <Alert tone="success">{labels.emailChanged}</Alert>}
        {showCode ? (
          <div className={styles.stack}>
            <VerifyCodePanel
              email={waiting}
              title={labels.emailPendingTitle}
              description={labels.emailPendingBody(
                waiting,
                pendingEmailExpiresAt && pendingEmail === waiting
                  ? formatDate(pendingEmailExpiresAt)
                  : undefined,
              )}
              labels={given}
              expiresAt={serverExpiry ?? localWindow?.expiresAt}
              expirySource={serverExpiry ? 'server' : (localWindow?.source ?? 'estimate')}
              resendExhausted={localWindow?.resendExhausted === true}
              // 이 요청은 다시 인증이 드니(비밀번호 · 메일 코드) 조용히 다시 보낼 수 없다 — 시간이 다 되면 「다시 받기 · 다른 주소로」로 포커스
              onExpire={() => againBox.current?.querySelector<HTMLButtonElement>('button')?.focus()}
              onVerify={async (code) => {
                await onConfirmCode(code)
                setLocal(null)
                setChanged(true)
                onConfirmed?.()
              }}
              onStartOver={() => {
                setNewEmail('')
                setEditing(true)
              }}
            />
            <p className={styles.muted}>{labels.emailPendingNote}</p>
            <div className={styles.row} ref={againBox}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setNewEmail(waiting)
                  setEditing(true)
                }}
              >
                {labels.emailSendAgain}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className={styles.form}
            onSubmit={submit}
            aria-label={labels.emailChangeSubmit}
            noValidate
          >
            {action.error && !isReauthFailure(action.raw) && (
              <Alert tone="danger">{action.error.message}</Alert>
            )}
            <Field
              id={ids.email}
              label={labels.emailNew}
              required
              error={attempt.attempted ? newEmailProblem : undefined}
            >
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              )}
            </Field>
            <div id={ids.proof}>
              <ReauthProof
                kind={kind}
                email={subject.email}
                providers={subject.providers}
                requestCode={requestReauthCode}
                onChange={setProof}
                failure={isReauthFailure(action.raw) ? action.raw : undefined}
                onProvider={
                  onProviderReauth && newEmail.trim()
                    ? (provider) => onProviderReauth(provider, newEmail.trim())
                    : undefined
                }
                confirmedWith={resume?.provider}
                labels={given}
              />
            </div>
            {kind !== 'provider' && (
              <FormProblems
                title={labels.formProblemsTitle}
                problems={attempt.attempted ? problems : []}
              />
            )}
            {kind !== 'provider' && (
              <div className={styles.row}>
                <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
                  {email ? labels.emailChangeSubmit : labels.emailAddSubmit}
                </Button>
                {editing && (
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    {labels.cancel}
                  </Button>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </SectionCard>
  )
}
