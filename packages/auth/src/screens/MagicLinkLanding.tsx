import { Link } from 'react-router-dom'
import { TokenLanding } from './TokenLanding'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type MagicLinkLandingProps = {
  token: string | null
  /** 토큰을 로그인으로 바꾼다(`session.magicLinkLogin`) */
  onRedeem: (token: string) => Promise<unknown>
  /** 로그인되면(보통 원래 가려던 곳으로 이동) */
  onDone: () => void
  /** 새 링크를 요청하는 곳(로그인 화면) */
  requestTo: string
  labels?: Partial<AuthLabels>
}

/** `/magic-link?token=` — 링크를 열면 로그인한다. 정지된 계정(403) 등은 일시 오류 줄로 보인다 */
export function MagicLinkLanding({
  token,
  onRedeem,
  onDone,
  requestTo,
  labels: given,
}: MagicLinkLandingProps) {
  const labels = mergeLabels(given)
  return (
    <TokenLanding
      token={token}
      run={onRedeem}
      onDone={onDone}
      labels={given}
      title={labels.magicLinkTitle}
      checking={labels.magicLinkChecking}
      done={<p>{labels.magicLinkChecking}</p>}
      invalidTitle={labels.magicLinkInvalidTitle}
      invalidBody={labels.magicLinkInvalidBody}
      invalid={
        <Link className={styles.link} to={requestTo}>
          {labels.magicLinkRequestNew}
        </Link>
      }
    />
  )
}
