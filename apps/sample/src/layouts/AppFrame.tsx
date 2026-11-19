import { WebHandoffGate } from '@skeleton/auth'
import { authSession, webHandoffApi } from '../auth/session'
import { releasePush } from '../auth/useSignOut'
import { useAuthLabels } from '../auth/useAuthLabels'
import { RootLayout } from './RootLayout'
import { PageSeo } from '../seo/PageSeo'

const deviceName = typeof navigator === 'undefined' ? undefined : navigator.userAgent.slice(0, 80)

/** 앱의 「웹 결제」로 넘어온 주소(`#handoff=<코드>`)를 읽어 로그인시킨다 - 코드가 없으면 아무 일도 없다 */
const redeem = async (code: string) => {
  authSession.signIn(await webHandoffApi.redeem(code, { deviceName }))
}

/** 이미 로그인한 브라우저에서 앱의 계정으로 바꿀 때 - 일반 로그아웃과 같이 푸시 기기 등록을 먼저 해지한다 */
const signOut = async () => {
  await releasePush()
  await authSession.logout()
}

/**
 * 모든 라우트의 바깥 — 화면마다 머리(SEO)를 맞추고 공통 틀(RootLayout)을 그린다. `RootLayout` 자체는 라우터 데이터 없이도 그려진다(단위 테스트).
 * 앱에서 「웹 결제」로 넘어온 주소의 로그인 코드는 로그인 가드(`RequireAuth`)보다 바깥인 여기서 받는다 - 가드가 로그인 화면으로 보내기 전에 세션이 열려야 한다.
 */
export function AppFrame() {
  const labels = useAuthLabels()
  return (
    <WebHandoffGate
      onRedeem={redeem}
      signInTo="/login"
      twoFactorTo="/login/two-factor"
      onSignOut={signOut}
      labels={labels}
    >
      <PageSeo />
      <RootLayout />
    </WebHandoffGate>
  )
}
