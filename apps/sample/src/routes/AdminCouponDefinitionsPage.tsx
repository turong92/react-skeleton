import { useCan } from '@skeleton/auth'
import { useMemo } from 'react'
import { AdminCouponDefinitions } from '@skeleton/rewards/admin'
import { Link } from 'react-router-dom'
import { createAccountSearch } from '../rewards/searchAccounts'
import { adminAccountsApi } from '../adminAccounts/api'
import { languageOf, useT } from '../i18n'
import { rewardsAdminApi } from '../rewards/api'
import { rewardsAdminLabelsFor, rewardsLabelsFor } from '../rewards/labels'

/**
 * 운영자 화면 - `@skeleton/rewards/admin` 의 `AdminCouponDefinitions`. 백엔드는 해당 모듈의 `skeleton.<module>.admin.enabled=true`(이 앱은 켠다)와 운영 권한이 필요하고,
 * 단추는 `useCan()` 으로 숨긴다(서버가 다시 판정한다). 필요 없는 프로젝트는 이 파일과 라우트 · 메뉴 한 줄을 지운다.
 */
export function AdminCouponDefinitionsPage() {
  const { locale } = useT()
  const searchAccounts = useMemo(() => createAccountSearch(adminAccountsApi), [])
  const language = languageOf(locale)
  const can = useCan()

  return (
    <AdminCouponDefinitions
      api={rewardsAdminApi}
      can={can}
      labels={rewardsAdminLabelsFor(language)}
      locale={language}
      userLabels={rewardsLabelsFor(language)}
      searchAccounts={searchAccounts}
      renderDetailLink={(definition, label, accessibleName, className) => (
        <Link
          to={`/admin/coupons/${encodeURIComponent(definition.id)}`}
          className={className}
          aria-label={accessibleName}
        >
          {label}
        </Link>
      )}
    />
  )
}
