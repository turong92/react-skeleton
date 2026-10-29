import { useCan } from '@skeleton/auth'
import { AdminBadgeAwards } from '@skeleton/rewards/admin'
import { useMemo } from 'react'
import { adminAccountsApi } from '../adminAccounts/api'
import { languageOf, useT } from '../i18n'
import { rewardsAdminApi } from '../rewards/api'
import { rewardsAdminLabelsFor } from '../rewards/labels'
import { createAccountSearch } from '../rewards/searchAccounts'

/** 운영자 화면 - `AdminBadgeAwards`(수여 · 회수 내역, 회수는 사유 필수). 백엔드 `badge.manage`. 계정 이름은 서버가 `account.read` 운영자에게만 준다 */
export function AdminBadgeAwardsPage() {
  const { locale } = useT()
  const language = languageOf(locale)
  const can = useCan()
  const searchAccounts = useMemo(() => createAccountSearch(adminAccountsApi), [])
  return (
    <AdminBadgeAwards
      api={rewardsAdminApi}
      searchAccounts={can('account.read') ? searchAccounts : undefined}
      can={can}
      labels={rewardsAdminLabelsFor(language)}
      locale={language}
    />
  )
}
