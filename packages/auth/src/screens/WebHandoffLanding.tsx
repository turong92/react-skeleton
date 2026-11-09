import { Link } from 'react-router-dom'
import { mfaRequiredOf } from '../mfa/mfaRequired'
import { MfaHandoff } from '../mfa/MfaHandoff'
import type { MfaRequired } from '../mfa/types'
import type { OnceRunner } from './runOnce'
import { TokenLanding } from './TokenLanding'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'

export type WebHandoffLandingProps = {
  code: string | null
  /** 코드를 로그인으로 바꾸고 세션에 들인다(`webHandoffApi.redeem` → `auth.signIn`) */
  onRedeem: (code: string) => Promise<unknown>
  /** 로그인되면 */
  onDone: () => void
  /** 코드를 쓸 수 없을 때(만료 · 이미 씀 · 앱 세션이 닫힘) 대신 로그인하는 곳 */
  signInTo: string
  /** 2단계 인증이 켜진 계정이다(`403 AUTH.MFA_REQUIRED`) - 호출자가 두 번째 단계로 보낸다. 안 주면 일시 오류 줄로 보인다 */
  onMfaRequired?: (mfa: MfaRequired) => void
  labels?: Partial<AuthLabels>
  /** 같은 코드를 화면이 다시 마운트돼도 한 번만 보내는 실행기 */
  once?: OnceRunner
}

/** 앱의 「웹 결제」로 넘어온 사람의 착지 화면 - 열자마자 코드를 한 번 바꾼다. 만료 · 이미 쓴 코드는 「쓸 수 없는 링크」(+로그인), 그 밖의 실패는 일시 오류 줄 */
export function WebHandoffLanding({
  code,
  onRedeem,
  onDone,
  signInTo,
  onMfaRequired,
  labels: given,
  once,
}: WebHandoffLandingProps) {
  const labels = mergeLabels(given)
  const signInLink = (
    <Link className={styles.link} to={signInTo}>
      {labels.webHandoffSignIn}
    </Link>
  )
  return (
    <TokenLanding
      token={code}
      once={once}
      onceKind="web-handoff"
      run={onRedeem}
      onDone={onDone}
      renderFailure={(error) => {
        const mfa = mfaRequiredOf(error)
        return mfa && onMfaRequired ? <MfaHandoff mfa={mfa} onMfaRequired={onMfaRequired} /> : null
      }}
      labels={given}
      title={labels.webHandoffTitle}
      checking={labels.webHandoffChecking}
      done={<p>{labels.webHandoffChecking}</p>}
      invalidTitle={labels.webHandoffInvalidTitle}
      invalidBody={labels.webHandoffInvalidBody}
      invalid={signInLink}
      failedExtra={signInLink}
    />
  )
}
