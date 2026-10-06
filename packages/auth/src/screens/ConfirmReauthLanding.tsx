import { Alert, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReauthLandingOutcome } from '../reauthLanding'
import { AuthLayout } from './AuthLayout'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import { useOnceOnMount } from './useOnceOnMount'

export type ConfirmReauthLandingProps = {
  token: string | null
  /** 토큰을 하려던 작업에 돌려준다(`resolveReauthLanding`) — 마운트 때 한 번 */
  onResolve: (token: string) => Promise<ReauthLandingOutcome>
  /** 계정 설정 경로 — 다른 탭 · 기기에서 연 링크는 여기서 이어 간다 */
  settingsTo: string
  labels?: Partial<AuthLabels>
}

type Phase = { kind: 'checking' } | { kind: 'done'; outcome: ReauthLandingOutcome }

/**
 * `/confirm-reauth?token=` — 비밀번호 없는 계정이 이메일 변경 · 첫 비밀번호 · 소셜 연결 전에 본인 확인 링크를 연다.
 * 링크를 열면 한 번 호출해(메일 스캐너의 GET 이 아니라 SPA 의 마운트) 토큰을 하려던 작업에 돌려주고, 이 탭이 그 작업을 모르면 설정으로 안내한다.
 */
export function ConfirmReauthLanding({
  token,
  onResolve,
  settingsTo,
  labels: given,
}: ConfirmReauthLandingProps) {
  const labels = mergeLabels(given)
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' })

  useOnceOnMount(
    async () => (token ? onResolve(token) : undefined),
    (result) => {
      if (!token) return
      setPhase({
        kind: 'done',
        outcome: result.ok ? result.value! : { status: 'failed', error: result.error },
      })
    },
  )

  const settingsLink = (
    <Link className={styles.link} to={settingsTo}>
      {labels.confirmReauthSettings}
    </Link>
  )

  if (!token)
    return (
      <AuthLayout title={labels.confirmReauthInvalidTitle}>
        <div className={styles.stack}>
          <p>{labels.confirmReauthInvalidBody}</p>
          {settingsLink}
        </div>
      </AuthLayout>
    )

  return (
    <AuthLayout title={labels.confirmReauthTitle}>
      <div className={styles.stack} aria-live="polite">
        {phase.kind === 'checking' && (
          <div className={styles.row}>
            <Spinner label={labels.confirmReauthChecking} />
            <span>{labels.confirmReauthChecking}</span>
          </div>
        )}
        {phase.kind === 'done' && phase.outcome.status === 'completed' && (
          <>
            <Alert tone="success">{labels.confirmReauthEmailChanged}</Alert>
            {settingsLink}
          </>
        )}
        {phase.kind === 'done' && phase.outcome.status === 'handed-off' && (
          <Alert tone="success">{labels.confirmReauthHandedOff}</Alert>
        )}
        {phase.kind === 'done' && phase.outcome.status === 'stashed' && (
          <>
            <Alert tone="success">
              {phase.outcome.resume === 'set-password'
                ? labels.confirmReauthStashedPassword
                : phase.outcome.resume === 'link-social'
                  ? labels.confirmReauthStashedSocial
                  : labels.confirmReauthStashed}
            </Alert>
            {settingsLink}
          </>
        )}
        {phase.kind === 'done' && phase.outcome.status === 'failed' && (
          <>
            <Alert tone="danger">{authErrorMessage(phase.outcome.error, labels).message}</Alert>
            {settingsLink}
          </>
        )}
      </div>
    </AuthLayout>
  )
}
