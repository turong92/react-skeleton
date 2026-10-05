import { useAuth } from '@skeleton/auth'
import { DashboardPage } from './DashboardPage'
import { LandingPage } from './LandingPage'

/** `/` — 로그인한 사람은 대시보드, 아닌 방문자는 랜딩. 토큰 저장소를 동기로 읽으니 깜박임이 없다 */
export function HomeRoute() {
  const { status } = useAuth()
  return status === 'authenticated' ? <DashboardPage /> : <LandingPage />
}
