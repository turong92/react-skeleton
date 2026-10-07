import { Alert, Button, FormProblems, useSubmitAttempt } from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { ReauthCredential } from '../account/accountApi'
import { isReauthFailure, type ReauthKind } from '../reauth/kind'
import { AuthLayout } from './AuthLayout'
import { ReauthProof } from './ReauthProof'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type SocialLinkProofScreenProps = {
  /** 연결하려는 제공자의 보이는 이름 */
  provider: string
  /** 계정에 맞는 증거(`reauthKindOf`) */
  kind: ReauthKind
  email: string | null
  /** 주소가 없는 계정이 다시 동의할 수 있는, 이미 연결된 제공자 */
  reauthProviders?: string[]
  /** `POST /account/reauth/confirmation` — 비밀번호 없는 계정의 인증번호 메일 */
  requestCode: () => Promise<unknown>
  /** 증거로 연결을 마친다. 틀리면(`CURRENT_PASSWORD_INVALID` · `CODE_INVALID` …) 던진다 — 서버가 제공자 코드를 바꾸기 **전에** 증거를 보므로 같은 인가 코드로 다시 시도할 수 있다 */
  onSubmit: (credential: ReauthCredential) => Promise<unknown>
  /** 주소가 없는 계정: 이 제공자의 동의를 다시 거친다(연결하려던 제공자의 코드는 앱이 state 에 묶어 둔다) */
  onProvider?: (reauthProvider: string) => void
  /** 그만두고 돌아갈 곳(계정 설정) */
  backTo: string
  labels?: Partial<AuthLabels>
}

/** 제공자에 다녀온 뒤, 계정이 소셜 연결 전에 하는 본인 확인(서버가 강제한다) — 비밀번호 · 메일 인증번호 · 제공자 동의 중 계정에 맞는 하나 */
export function SocialLinkProofScreen({
  provider,
  kind,
  email,
  reauthProviders,
  requestCode,
  onSubmit,
  onProvider,
  backTo,
  labels: given,
}: SocialLinkProofScreenProps) {
  const labels = mergeLabels(given)
  const [proof, setProof] = useState<ReauthCredential | null>(null)
  const action = useAction(labels)
  const proofId = `${useId()}-proof`
  const attempt = useSubmitAttempt()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!proof) return attempt.fail(proofId) // 버튼은 늘 눌린다 — 본인 확인이 모자라면 이유를 말한다
    await action.run(() => onSubmit(proof))
  }

  return (
    <AuthLayout title={labels.reauthTitle}>
      <form className={styles.form} onSubmit={submit} aria-label={labels.reauthTitle} noValidate>
        <p className={styles.muted}>{labels.linkReauthHint(provider)}</p>
        {action.error && !isReauthFailure(action.raw) && (
          <Alert tone="danger">{action.error.message}</Alert>
        )}
        <div id={proofId}>
          <ReauthProof
            kind={kind}
            email={email}
            providers={reauthProviders}
            requestCode={requestCode}
            onChange={setProof}
            failure={isReauthFailure(action.raw) ? action.raw : undefined}
            onProvider={onProvider}
            labels={given}
          />
        </div>
        {kind !== 'provider' && (
          <FormProblems
            title={labels.formProblemsTitle}
            problems={
              attempt.attempted && proof === null
                ? [{ key: 'proof', message: labels.problemProofMissing, target: proofId }]
                : []
            }
          />
        )}
        <div className={styles.row}>
          {kind !== 'provider' && (
            <Button type="submit" loading={action.busy} loadingLabel={labels.submitting}>
              {labels.methodLink(provider)}
            </Button>
          )}
          <Link className={styles.link} to={backTo}>
            {labels.cancel}
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
