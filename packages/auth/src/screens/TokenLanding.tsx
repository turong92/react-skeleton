import { ErrorCodes } from '@skeleton/api-client'
import { Alert, Button, Spinner } from '@skeleton/ui'
import { useRef, useState, type ReactNode } from 'react'
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
  /** 실패를 이 화면의 일반 문구 대신 **자기 화면**으로 그리고 싶을 때(예: 탈퇴 대기 중 계정의 링크 로그인) — 노드를 돌려주면 그것이 화면 전체가 된다 */
  renderFailure?: (error: unknown) => ReactNode | null
  /**
   * true 면 열자마자 서버를 부르지 않고 「계속」 버튼을 눌러야 부른다 — 링크를 대신 열어 보는 메일 스캐너(JS 를 실행하는 것)가
   * 확정해 버리지 못하게. 확정이 되돌릴 수 없는 화면(이메일 인증 · 이메일 변경)의 기본값이다. 링크 로그인은 계약이 마운트 POST 를 허용해 false
   */
  requireConfirm?: boolean
  /** 계속 버튼 위 한 줄 설명 */
  confirmPrompt?: string
  labels?: Partial<AuthLabels>
}

type Phase = 'ready' | 'checking' | 'done' | 'invalid' | 'failed' | 'custom'

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
  renderFailure,
  requireConfirm = false,
  confirmPrompt,
  labels: given,
}: TokenLandingProps) {
  const labels = mergeLabels(given)
  const [phase, setPhase] = useState<Phase>(
    token ? (requireConfirm ? 'ready' : 'checking') : 'invalid',
  )
  const [failure, setFailure] = useState<string | null>(null)
  const [custom, setCustom] = useState<ReactNode>(null)

  function settle(outcome: { ok: true; value: unknown } | { ok: false; error: unknown }) {
    if (outcome.ok) {
      setPhase('done')
      onDone?.()
      return
    }
    const own = renderFailure?.(outcome.error)
    if (own) {
      setCustom(own)
      setPhase('custom')
      return
    }
    const info = authErrorMessage(outcome.error, labels)
    if (info.code === ErrorCodes.ACCOUNT_TOKEN_INVALID) setPhase('invalid')
    else {
      setFailure(info.message)
      setPhase('failed')
    }
  }

  // 확인 없이 도착하는 링크: 마운트 때 한 번(StrictMode 에서도 한 번)
  useOnceOnMount(
    async () => (token && !requireConfirm ? run(token) : undefined),
    (outcome) => {
      if (!token || requireConfirm) return
      settle(outcome)
    },
  )

  // 확인이 필요한 링크: 사람이 누른 한 번
  const clicked = useRef(false)
  function confirm() {
    if (!token || clicked.current) return
    clicked.current = true
    setPhase('checking')
    run(token).then(
      (value) => settle({ ok: true, value }),
      (error: unknown) => settle({ ok: false, error }),
    )
  }

  if (phase === 'custom') return <>{custom}</>
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
        {phase === 'ready' && (
          <>
            {confirmPrompt && <p>{confirmPrompt}</p>}
            <div>
              <Button onClick={confirm}>{labels.landingContinue}</Button>
            </div>
          </>
        )}
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
