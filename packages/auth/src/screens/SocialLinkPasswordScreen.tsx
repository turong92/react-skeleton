import { Alert, Button } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { PasswordField } from './PasswordField'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type SocialLinkPasswordScreenProps = {
  /** 연결하려는 제공자의 보이는 이름 */
  provider: string
  /** 현재 비밀번호로 연결을 마친다. 틀리면(400 `ACCOUNT.CURRENT_PASSWORD_INVALID`) 던진다 — 같은 인가 코드로 다시 시도할 수 있다 */
  onSubmit: (currentPassword: string) => Promise<unknown>
  /** 그만두고 돌아갈 곳(계정 설정) */
  backTo: string
  labels?: Partial<AuthLabels>
}

/** 제공자에 다녀온 뒤, 비밀번호가 있는 계정이 소셜 연결 전에 하는 본인 확인(서버가 강제한다) */
export function SocialLinkPasswordScreen({
  provider,
  onSubmit,
  backTo,
  labels: given,
}: SocialLinkPasswordScreenProps) {
  const labels = mergeLabels(given)
  const [password, setPassword] = useState('')
  const action = useAction(labels)

  async function submit(event: FormEvent) {
    event.preventDefault()
    await action.run(() => onSubmit(password))
  }

  return (
    <AuthLayout title={labels.confirmReauthTitle}>
      <form className={styles.form} onSubmit={submit} aria-label={labels.confirmReauthTitle}>
        <p className={styles.muted}>{labels.linkPasswordHint(provider)}</p>
        {action.error && <Alert tone="danger">{action.error.message}</Alert>}
        <PasswordField
          label={labels.currentPassword}
          labels={labels}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        <div className={styles.row}>
          <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
            {labels.methodLink(provider)}
          </Button>
          <Link className={styles.link} to={backTo}>
            {labels.cancel}
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
