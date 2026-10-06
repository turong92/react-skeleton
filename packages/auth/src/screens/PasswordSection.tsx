import { Alert, Button, SectionCard } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { passwordRequirements, violationsOf } from '../account/passwordRules'
import type { PasswordPolicy, PasswordViolation } from '../account/types'
import { PasswordField } from './PasswordField'
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
  onChange: (request: { currentPassword?: string; newPassword: string }) => Promise<unknown>
  labels?: Partial<AuthLabels>
}

/** 비밀번호 절 — 바꾸면 다른 기기는 로그아웃되고 이 기기는 그대로 */
export function PasswordSection({
  hasPassword,
  policy,
  email,
  onChange,
  labels: given,
}: PasswordSectionProps) {
  const labels = mergeLabels(given)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [done, setDone] = useState(false)
  const [violations, setViolations] = useState<PasswordViolation[]>([])
  const action = useAction(labels)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setDone(false)
    setViolations([])
    if (policy && passwordRequirements(policy, next, email).some((r) => !r.met)) return
    const ok = await action.run(() =>
      onChange({ ...(hasPassword ? { currentPassword: current } : {}), newPassword: next }),
    )
    if (ok) {
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
