import { Alert, Button, SectionCard } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { passwordRequirements, violationsOf } from '../account/passwordRules'
import type { PasswordPolicy, PasswordViolation } from '../account/types'
import { submitWithReauth } from '../reauth'
import { PasswordField } from './PasswordField'
import { ReauthNotices, type ReauthSupport } from './ReauthNotices'
import { PasswordHints } from './PasswordHints'
import styles from './auth.module.css'
import { ErrorCodes } from '@skeleton/api-client'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type PasswordSectionProps = {
  /** 소셜 · 링크로만 가입한 계정은 false — 현재 비밀번호 없이 첫 비밀번호를 정한다 */
  hasPassword: boolean
  policy?: PasswordPolicy
  email?: string
  onChange: (request: {
    currentPassword?: string
    confirmationToken?: string
    newPassword: string
  }) => Promise<unknown>
  /** 첫 비밀번호를 정하는(비밀번호 없는) 계정의 다시 인증 — 메일 링크 왕복 */
  reauth?: ReauthSupport
  /** 비밀번호 없는 계정의 확인 메일을 보낼 주소(안내 문장) */
  mailTo?: string | null
  labels?: Partial<AuthLabels>
}

/** 비밀번호 절 — 바꾸면 다른 기기는 로그아웃되고 이 기기는 그대로 */
export function PasswordSection({
  hasPassword,
  policy,
  email,
  onChange,
  reauth,
  mailTo = email ?? null,
  labels: given,
}: PasswordSectionProps) {
  const labels = mergeLabels(given)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [done, setDone] = useState(false)
  const [mailSent, setMailSent] = useState(false)
  const resend = useAction(labels)
  const reauthActive = !hasPassword && !!reauth
  const [violations, setViolations] = useState<PasswordViolation[]>([])
  const action = useAction(labels)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setDone(false)
    setViolations([])
    if (policy && passwordRequirements(policy, next, email).some((r) => !r.met)) return
    setMailSent(false)
    let finished = true
    const ok = await action.run(async () => {
      if (!hasPassword && reauth) {
        const result = await submitWithReauth({
          store: reauth.store,
          requestMail: reauth.requestMail,
          // 새 비밀번호는 저장하지 않는다 — 링크를 연 뒤 한 번 더 입력한다
          action: { kind: 'set-password' },
          run: (credential) => onChange({ newPassword: next, ...credential }),
        })
        finished = result.status === 'done'
        setMailSent(!finished)
        return
      }
      await onChange({ ...(hasPassword ? { currentPassword: current } : {}), newPassword: next })
    })
    if (ok && finished) {
      setDone(true)
      setCurrent('')
      setNext('')
    }
  }
  // 정책 위반은 힌트 목록이 보여 준다 — 오류 줄에는 중복해서 올리지 않는다
  const serverViolations = violationsOf(action.raw)
  if (serverViolations.length > 0 && violations.length === 0) setViolations(serverViolations)
  const currentWrong = action.error?.code === ErrorCodes.ACCOUNT_CURRENT_PASSWORD_INVALID
  const showError = action.error && !currentWrong && serverViolations.length === 0

  return (
    <SectionCard
      id="password"
      title={hasPassword ? labels.sectionPassword : labels.passwordSetTitle}
      description={hasPassword ? labels.passwordOtherSessionsNote : labels.passwordSetHint}
    >
      <form className={styles.form} onSubmit={submit} aria-label={labels.sectionPassword}>
        <ReauthNotices
          active={reauthActive}
          sent={mailSent}
          ready={reauthActive && reauth.store.hasToken()}
          email={mailTo}
          resending={resend.busy}
          onResend={() => void resend.run(() => reauth!.requestMail())}
          labels={labels}
        />
        {showError && <Alert tone="danger">{action.error?.message}</Alert>}
        {done && <Alert tone="success">{labels.passwordChanged}</Alert>}
        {hasPassword && (
          <PasswordField
            label={labels.currentPassword}
            labels={labels}
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            error={currentWrong ? action.error?.message : undefined}
          />
        )}
        <PasswordField
          label={labels.newPassword}
          labels={labels}
          autoComplete="new-password"
          value={next}
          onChange={setNext}
        />
        {policy && (
          <PasswordHints
            policy={policy}
            password={next}
            email={email}
            labels={labels}
            serverViolations={violations}
          />
        )}
        <div>
          <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
            {labels.passwordChangeSubmit}
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}
