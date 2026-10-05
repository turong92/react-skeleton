import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { useAuth } from '@skeleton/auth'
import { Button, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Case, Row } from '../components/Section'
import { DEMO_LOGIN } from '../fakes/fakeAuthApi'

/** 가짜 `AuthApi` 로 도는 로그인 폼 — 로그인하면 `RequireAuth` 아래의 비밀 페이지가 열린다 */
export function AuthDemo() {
  const { status, principal, login, logout } = useAuth()
  const [email, setEmail] = useState(DEMO_LOGIN.email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await login({ email, password })
    } catch (caught) {
      if (isErrorCode(caught, ErrorCodes.AUTH_INVALID_CREDENTIALS))
        setError('이메일 또는 비밀번호가 맞지 않습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p>
        데모 계정: <code>{DEMO_LOGIN.email}</code> / 비밀번호 <code>{DEMO_LOGIN.password}</code>
      </p>
      {status === 'authenticated' ? (
        <Case label="authenticated">
          <p>
            로그인됨: <code>{principal?.email}</code>
          </p>
          <Row>
            <Link to="/packages/auth/secret">비밀 페이지 열기 (RequireAuth)</Link>
            <Button variant="ghost" size="sm" onClick={logout}>
              로그아웃
            </Button>
          </Row>
        </Case>
      ) : (
        <Case label="anonymous">
          <form onSubmit={submit} aria-label="로그인">
            <Field label="이메일" required requiredMark="(필수)">
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Field label="비밀번호" required requiredMark="(필수)" error={error}>
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" loading={busy} loadingLabel="로그인 중">
              로그인
            </Button>
          </form>
          <p>
            로그인 전에는 <Link to="/packages/auth/secret">비밀 페이지</Link> 가 이 화면으로
            돌려보낸다.
          </p>
        </Case>
      )}
    </>
  )
}
