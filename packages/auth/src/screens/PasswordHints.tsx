import { passwordRequirements, passwordStrength } from '../account/passwordRules'
import type { PasswordPolicy, PasswordViolation } from '../account/types'
import styles from './auth.module.css'
import type { AuthLabels } from './labels'

export type PasswordHintsProps = {
  policy: PasswordPolicy
  password: string
  /** 이메일 앞부분 금지 규칙에 쓴다 */
  email?: string
  labels: AuthLabels
  /** 서버가 거절한 항목 — 「통과」로 보이더라도 틀림으로 표시한다(`TOO_COMMON` · `BREACHED` 는 서버만 안다) */
  serverViolations?: PasswordViolation[]
}

/** 정책에서 읽은 규칙 체크리스트 + 강도 막대. 입력이 바뀔 때마다 낭독되도록 `aria-live` */
export function PasswordHints({
  policy,
  password,
  email,
  labels,
  serverViolations = [],
}: PasswordHintsProps) {
  const requirements = passwordRequirements(policy, password, email)
  const level = passwordStrength(password, policy)
  const listed = new Set(requirements.map((r) => r.code))
  const extra = serverViolations.filter((code) => !listed.has(code))
  return (
    <div className={styles.hints} aria-live="polite">
      <div>
        <div
          className={styles.meter}
          data-level={level}
          role="img"
          aria-label={`${labels.passwordStrengthLabel}: ${labels.passwordStrength[level]}`}
        >
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className={styles.muted}>
          {labels.passwordStrengthLabel}: {labels.passwordStrength[level]}
        </span>
      </div>
      <p className={styles.muted}>{labels.passwordRequirementsTitle}</p>
      <ul className={styles.requirements}>
        {requirements.map(({ code, met }) => {
          const failedByServer = serverViolations.includes(code)
          return (
            <li key={code} data-met={met && !failedByServer}>
              <span aria-hidden="true">{met && !failedByServer ? '✓' : '○'}</span>
              <span>
                {labels.passwordRule[code]}
                <span className={styles.srOnly}>
                  {' '}
                  {met && !failedByServer ? labels.requirementMet : labels.requirementUnmet}
                </span>
              </span>
            </li>
          )
        })}
        {extra.map((code) => (
          <li key={code} data-met="false">
            <span aria-hidden="true">○</span>
            <span>
              {labels.passwordRule[code]}
              <span className={styles.srOnly}> {labels.requirementUnmet}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
