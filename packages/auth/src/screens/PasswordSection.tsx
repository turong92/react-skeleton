import { Alert, Button, FormProblems, SectionCard, useSubmitAttempt } from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import { violationsOf } from '../account/passwordRules'
import type { PasswordPolicy, PasswordViolation } from '../account/types'
import type { ReauthCredential } from '../account/accountApi'
import { isReauthFailure, reauthKindOf, type ReauthSubject } from '../reauth/kind'
import { NewPasswordFields } from './NewPasswordFields'
import { ReauthProof } from './ReauthProof'
import { PasswordHints } from './PasswordHints'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { usePasswordConfirm } from './passwordConfirm'
import { passwordProblems } from './passwordProblems'
import { useAction } from './useAction'

export type PasswordSectionProps = {
  /** 다시 인증의 종류를 고르는 `me` 의 부분(`reauthSubjectOf(me)`) — 비밀번호가 없는 계정은 현재 비밀번호 대신 메일로 받은 인증번호로 첫 비밀번호를 정한다 */
  subject: ReauthSubject
  policy?: PasswordPolicy
  email?: string
  onChange: (request: ReauthCredential & { newPassword: string }) => Promise<unknown>
  /** `POST /account/reauth/confirmation` — 비밀번호 없는 계정의 인증번호 메일 */
  requestReauthCode: () => Promise<unknown>
  labels?: Partial<AuthLabels>
  /** 새 비밀번호를 한 번 더 입력받는다(기본 false — 모듈은 중립이라 앱이 켠다) — 다르면 제출하지 않는다. 확인 값은 서버로 보내지 않는다 */
  confirmPassword?: boolean
}

/** 비밀번호 절 — 바꾸면 다른 기기는 로그아웃되고 이 기기는 그대로. 첫 비밀번호는 메일 주소가 인증된 계정만(주소가 없으면 정할 수 없다) */
export function PasswordSection({
  subject,
  policy,
  email,
  onChange,
  requestReauthCode,
  labels: given,
  confirmPassword = false,
}: PasswordSectionProps) {
  const labels = mergeLabels(given)
  const hasPassword = subject.hasPassword
  const kind = reauthKindOf(subject)
  const [next, setNext] = useState('')
  const [proof, setProof] = useState<ReauthCredential | null>(null)
  const [done, setDone] = useState(false)
  const [violations, setViolations] = useState<PasswordViolation[]>([])
  const action = useAction(labels)
  const uid = useId()
  const ids = { password: `${uid}-password`, confirm: `${uid}-confirm`, proof: `${uid}-proof` }
  const attempt = useSubmitAttempt()
  const confirm = usePasswordConfirm({
    enabled: confirmPassword,
    password: next,
    attempted: attempt.attempted,
    labels,
  })
  const check = passwordProblems({ labels, password: next, email, policy, confirm, ids })
  // 본인 확인(현재 비밀번호 · 메일 인증번호)이 모자라도 버튼은 눌린다 — 막힌 이유를 말해야 하니까
  const problems = [
    ...(proof === null
      ? [{ key: 'proof', message: labels.problemProofMissing, target: ids.proof }]
      : []),
    ...check.problems,
  ]

  async function submit(event: FormEvent) {
    event.preventDefault()
    setDone(false)
    setViolations([])
    if (problems.length > 0) return attempt.fail(problems[0].target)
    const ok = await action.run(() => onChange({ ...proof, newPassword: next }))
    if (ok) {
      setDone(true)
      setNext('')
      confirm.reset()
      attempt.reset()
      setProof(null)
    }
  }
  // 정책 위반은 힌트 목록이 보여 준다 — 오류 줄에는 중복해서 올리지 않는다
  const serverViolations = violationsOf(action.raw)
  if (serverViolations.length > 0 && violations.length === 0) setViolations(serverViolations)
  const proofFailure = isReauthFailure(action.raw) ? action.raw : undefined
  const showError = action.error && !proofFailure && serverViolations.length === 0

  if (kind === 'provider')
    return (
      <SectionCard id="password" title={labels.passwordSetTitle}>
        <Alert tone="info">{labels.passwordNeedsEmail}</Alert>
      </SectionCard>
    )
  return (
    <SectionCard
      id="password"
      title={hasPassword ? labels.sectionPassword : labels.passwordSetTitle}
      description={hasPassword ? labels.passwordOtherSessionsNote : labels.passwordSetHint}
    >
      <form
        className={styles.form}
        onSubmit={submit}
        aria-label={labels.sectionPassword}
        noValidate
      >
        {showError && <Alert tone="danger">{action.error?.message}</Alert>}
        {done && <Alert tone="success">{labels.passwordChanged}</Alert>}
        <div id={ids.proof}>
          <ReauthProof
            kind={kind}
            email={subject.email}
            requestCode={hasPassword ? undefined : requestReauthCode}
            onChange={setProof}
            failure={proofFailure}
            labels={given}
          />
        </div>
        <NewPasswordFields
          label={labels.newPassword}
          labels={labels}
          value={next}
          onChange={setNext}
          confirm={confirm}
          ids={ids}
          error={attempt.attempted ? check.passwordError : undefined}
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
        <FormProblems
          title={labels.formProblemsTitle}
          problems={attempt.attempted ? problems : []}
        />
        <div>
          <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
            {labels.passwordChangeSubmit}
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}
