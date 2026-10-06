import { ErrorCodes } from '@skeleton/api-client'
import { Alert, Spinner } from '@skeleton/ui'
import { useState, type ReactNode } from 'react'
import { AuthLayout } from './AuthLayout'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { useOnceOnMount } from './useOnceOnMount'

export type TokenLandingProps = {
  token: string | null
  /** 토큰을 서버로 보낸다. `ACCOUNT.TOKEN_INVALID`(410)면 「안 되는 링크」 상태 */
  run: (token: string) => Promise<unknown>
  title: string
  checking: string
  /** 성공 본문 · 동작(로그인으로 가기) */
  done: ReactNode
  invalidTitle: string
  invalidBody: string
  /** 안 되는 링크 아래(다시 요청하는 폼 · 링크) */
  invalid?: ReactNode
  onDone?: () => void
  labels?: Partial<AuthLabels>
}

type Phase = 'checking' | 'done' | 'invalid' | 'failed'

/** 메일 링크 도착 화면의 공통 뼈대 — 열자마자 한 번 호출하고(메일 스캐너의 GET 이 아니라 SPA 의 POST) 성공 · 안 되는 링크 · 일시 오류를 가른다 */
export function TokenLanding({
  token,
  run,
  title,
  checking,
  done,
  invalidTitle,
  invalidBody,
  invalid,
  onDone,
  labels: given,
}: TokenLandingProps) {
  const labels = mergeLabels(given)
  const [phase, setPhase] = useState<Phase>(token ? 'checking' : 'invalid')
  const [failure, setFailure] = useState<string | null>(null)

  useOnceOnMount(
    async () => (token ? run(token) : undefined),
    (outcome) => {
      if (!token) return
      if (outcome.ok) {
        setPhase('done')
        onDone?.()
        return
      }
      const info = authErrorMessage(outcome.error, labels)
      if (info.code === ErrorCodes.ACCOUNT_TOKEN_INVALID) setPhase('invalid')
      else {
        setFailure(info.message)
        setPhase('failed')
      }
    },
  )

  if (phase === 'invalid')
    return (
      <AuthLayout title={invalidTitle}>
        <div className={styles.stack}>
          <p>{invalidBody}</p>
          {invalid}
        </div>
      </AuthLayout>
    )
  return (
    <AuthLayout title={title}>
      <div className={styles.stack} aria-live="polite">
        {phase === 'checking' && (
          <div className={styles.row}>
            <Spinner label={checking} />
            <span>{checking}</span>
          </div>
        )}
        {phase === 'done' && done}
        {phase === 'failed' && <Alert tone="danger">{failure}</Alert>}
      </div>
    </AuthLayout>
  )
}
