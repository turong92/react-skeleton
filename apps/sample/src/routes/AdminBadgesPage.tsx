import { useCan } from '@skeleton/auth'
import { AdminBadges } from '@skeleton/rewards/admin'
import { useMemo } from 'react'
import { adminAccountsApi } from '../adminAccounts/api'
import { languageOf, useT } from '../i18n'
import { rewardsAdminApi } from '../rewards/api'
import { rewardsAdminLabelsFor } from '../rewards/labels'
import { createAccountSearch } from '../rewards/searchAccounts'

/**
 * 운영자 화면 - `@skeleton/rewards/admin` 의 `AdminBadges`. 백엔드 `skeleton.badge.admin.enabled=true`(이 앱은 켠다)와 `badge.manage` 권한이 필요하다.
 * 「수동 수여」의 계정 찾기는 계정 조회 권한(`account.read`)이 있을 때만 준다. 필요 없는 프로젝트는 이 파일과 라우트 · 메뉴 한 줄을 지운다.
 */
export function AdminBadgesPage() {
  const { locale } = useT()
  const language = languageOf(locale)
  const can = useCan()
  const searchAccounts = useMemo(() => createAccountSearch(adminAccountsApi), [])
  return (
    <AdminBadges
      api={rewardsAdminApi}
      searchAccounts={can('account.read') ? searchAccounts : undefined}
      can={can}
      labels={rewardsAdminLabelsFor(language)}
    />
  )
}
