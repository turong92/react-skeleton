import { useAuth } from '@skeleton/auth'
import { defaultDashboardLabels, koDashboardLabels, DashboardView } from '@skeleton/dashboard'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../adminDashboard/api'
import { languageOf, useT } from '../i18n'

/**
 * 관리자 대시보드 - `@skeleton/dashboard`(`DashboardView` 한 덩어리). 백엔드는 `dashboard` 모듈(`skeleton.dashboard.admin.enabled=true`, 이 앱은 켬)과 `dashboard.read` 권한이 필요하다.
 * Cloudflare · GA 숫자는 서버에 키를 넣은 만큼 보이고, 없는 출처는 그 카드만 「키를 넣으면 보입니다」 안내로 남는다.
 * 필요 없는 프로젝트는 이 파일과 라우트 · 메뉴 한 줄을 지운다.
 */
export function AdminDashboardPage() {
  const { t, locale } = useT()
  const { principal } = useAuth()
  const language = languageOf(locale)
  return (
    <DashboardView
      api={dashboardApi}
      locale={language === 'ko' ? 'ko-KR' : 'en-US'}
      labels={language === 'ko' ? koDashboardLabels : defaultDashboardLabels}
      subtitle={t('appName')}
      layoutKey={principal?.accountId}
      renderLink={(href, children, className) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )}
    />
  )
}
