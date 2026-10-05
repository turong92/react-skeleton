import { useAuth } from '@skeleton/auth'
import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Button, Card, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (caught) {
      // 비밀번호 틀림만 폼에 보여 주고, 나머지 에러는 전역 토스트가 이미 알렸다
      if (isErrorCode(caught, ErrorCodes.AUTH_INVALID_CREDENTIALS)) {
        setError('이메일 또는 비밀번호가 맞지 않습니다.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="로그인">
      <form className={styles.form} onSubmit={submit}>
        <Field label="이메일" required requiredMark="(필수)">
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
        <Field label="비밀번호" required requiredMark="(필수)" error={error}>
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
        <Button type="submit" loading={busy} loadingLabel="로그인 중">
          로그인
        </Button>
      </form>
    </Card>
  )
}
