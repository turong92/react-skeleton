import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { useAuth } from '@skeleton/auth'
import { Button, Card, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import styles from './LoginPage.module.css'

/** Patterns/Login page 를 옮긴 화면 — 비밀번호 오류만 폼에 보이고 나머지 에러는 전역 토스트 */
export function LoginPage() {
  const { t } = useT()
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  if (status === 'authenticated') return <Navigate to={from} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailed(false)
    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (caught) {
      if (isErrorCode(caught, ErrorCodes.AUTH_INVALID_CREDENTIALS)) setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.center}>
      <div className={styles.intro}>
        <h1>{t('login.title')}</h1>
        <p>{t('login.subtitle')}</p>
      </div>
      <Card>
        <form className={styles.form} onSubmit={submit} aria-label={t('login.title')}>
          {failed && (
            <p role="alert" className={styles.failure}>
              {t('login.invalid')}
            </p>
          )}
          <Field label={t('login.email')} required>
            {(control) => (
              <Input
                {...control}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('login.password')} required>
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit" loading={busy} loadingLabel={t('login.submitting')}>
            {t('login.submit')}
          </Button>
        </form>
      </Card>
      <div className={styles.demo}>
        <p>{t('login.demoHint')}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEmail(t('login.demoEmail'))
            setPassword(t('login.demoPassword'))
          }}
        >
          {t('login.demoFill')}
        </Button>
      </div>
    </div>
  )
}
