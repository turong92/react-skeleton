import { createAdminAccountsApi, AdminAccounts } from '@skeleton/auth/admin'
import { apiClient } from '../api/client'
import { useAuthLabels } from '../auth/useAuthLabels'

const adminApi = createAdminAccountsApi(apiClient)

/**
 * 운영자 계정 화면 — `@skeleton/auth/admin`(선택 내보내기). 백엔드는 `skeleton.account.admin.enabled=true`(이 앱은 켬)와 ADMIN 역할이 필요하다.
 * 필요 없는 프로젝트는 이 파일과 라우트 한 줄을 지우면 번들에서도 빠진다.
 */
export function AdminAccountsPage() {
  return (
    <AdminAccounts
      api={adminApi}
      assignableRoles={['ADMIN', 'MODERATOR']}
      labels={useAuthLabels()}
    />
  )
}
