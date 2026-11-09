import { useEffect, useReducer, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { mfaChallengeState } from '../mfa/challengeState'
import { useMounted } from '../routes/useMounted'
import { useAuth } from '../useAuth'
import { readHandoffCode } from './handoffCode'
import type { AuthLabels } from './labels'
import type { OnceRunner } from './runOnce'
import { gateReducer, withoutHandoff, type GatePhase } from './webHandoffGateState'
import { WebHandoffLanding } from './WebHandoffLanding'
import { WebHandoffSwitchConfirm } from './WebHandoffSwitchConfirm'

export type WebHandoffGateProps = {
  /** 코드를 로그인으로 바꾸고 세션에 들인다(`webHandoffApi.redeem` → `auth.signIn`) */
  onRedeem: (code: string) => Promise<unknown>
  /** 코드를 쓸 수 없을 때 대신 로그인하는 곳 */
  signInTo: string
  /** 2단계 인증 화면의 경로(`paths.twoFactor`). 주면 2단계 계정은 거기서 두 번째 단계를 거친 뒤 이 결제 화면으로 돌아온다. 안 주면 안내 줄 */
  twoFactorTo?: string
  /** 이미 로그인한 브라우저에서 「나가고 계속」을 고르면 부른다(푸시 기기 해지 같은 앱 정리 + 로그아웃). 안 주면 `auth.logout()` */
  onSignOut?: () => Promise<unknown>
  labels?: Partial<AuthLabels>
  once?: OnceRunner
  /** 주소에 코드가 없으면 곧바로, 있으면 코드를 바꿔 로그인된 뒤에 보이는 화면(보통 결제 화면 - 로그인 가드 **바깥**에 둔다) */
  children: ReactNode
}

function initialPhase(
  mounted: boolean,
  location: { hash: string; pathname: string },
  signedIn: boolean,
): GatePhase {
  // 서버 · 하이드레이션 중에는 주소의 조각을 못 읽는다 - 마운트된 뒤에 읽는다(`TokenPage` 와 같은 규칙). 브라우저(SPA)에서는 첫 그림부터 정한다
  return mounted
    ? gateReducer(
        { kind: 'pending' },
        { type: 'read', code: readHandoffCode(location), signedIn, path: location.pathname },
      )
    : { kind: 'pending' }
}

/**
 * 웹 결제 주소(`<web-checkout-url>#handoff=<코드>`)의 문지기. 주소에 코드가 있으면 읽자마자 **라우터로** 주소에서 지우고(`replace` - 로그인 가드가 로그인 화면에 실어 보내는 위치에
 * 코드가 남지 않게), 착지 화면에서 한 번 바꾼 뒤 `children` 을 보인다 - 로그인 가드(`RequireAuth`)보다 **바깥**에 둬야 가드가 로그인 화면으로 보내기 전에 세션이 열린다.
 * 이미 로그인한 브라우저면 묻는다(「나가고 앱의 계정으로 계속할까요?」) - 코드에는 계정이 안 보이므로 늘 묻는다. 화면에서 다른 경로로 나가면(실패 뒤 「로그인」 · 2단계) 문을 열어 준다.
 * 코드가 없으면 아무것도 하지 않는다. Router 와 `AuthProvider` 안에서 쓴다.
 */
export function WebHandoffGate({
  children,
  onRedeem,
  twoFactorTo,
  onSignOut,
  ...landing
}: WebHandoffGateProps) {
  const mounted = useMounted()
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const signedIn = auth.status !== 'anonymous'
  const [phase, dispatch] = useReducer(gateReducer, undefined, () =>
    initialPhase(mounted, location, signedIn),
  )

  // 하이드레이션이 끝난 뒤에 처음 읽는다
  useEffect(() => {
    if (mounted && phase.kind === 'pending')
      dispatch({ type: 'read', code: readHandoffCode(location), signedIn, path: location.pathname })
  }, [mounted, phase.kind, location, signedIn])

  // 읽은 코드는 화면의 메모리에 있다 - 라우터 위치에서 바로 지운다(조각이든 쿼리든)
  useEffect(() => {
    if (!mounted) return
    const clean = withoutHandoff(location)
    if (clean) navigate(clean, { replace: true, state: location.state })
  }, [mounted, location, navigate])

  // 화면의 링크 · 이동으로 경로가 바뀌면 놓아 준다
  useEffect(() => {
    dispatch({ type: 'moved', path: location.pathname })
  }, [location.pathname])

  if (phase.kind === 'pending') return null
  if (phase.kind === 'open') return <>{children}</>
  if (phase.kind === 'confirm')
    return (
      <WebHandoffSwitchConfirm
        labels={landing.labels}
        onCancel={() => dispatch({ type: 'cancelled' })}
        onContinue={async () => {
          await (onSignOut ? onSignOut() : auth.logout()) // 이 기기에서 먼저 나간다(서버 통보가 실패해도 로그아웃은 유지)
          dispatch({ type: 'confirmed' })
        }}
      />
    )
  const target = `${phase.anchor}${location.search}`
  return (
    <WebHandoffLanding
      code={phase.code}
      onRedeem={onRedeem}
      onDone={() => dispatch({ type: 'signedIn' })}
      onMfaRequired={
        twoFactorTo
          ? (mfa) => navigate(twoFactorTo, { replace: true, state: mfaChallengeState(mfa, target) })
          : undefined
      }
      {...landing}
    />
  )
}
