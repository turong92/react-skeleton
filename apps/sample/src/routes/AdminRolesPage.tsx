import { AdminRoles, koAdminRolesLabels } from '@skeleton/auth/admin'
import { useQueryClient } from '@tanstack/react-query'
import { adminRolesApi } from '../adminRoles/api'
import { assignableRolesKey } from '../adminRoles/useAssignableRoles'
import { useAuthLabels } from '../auth/useAuthLabels'
import { useT } from '../i18n'

/**
 * 운영자 역할 화면 — `@skeleton/auth/admin`(선택 내보내기). 백엔드는 `authz` 모듈(`skeleton.authz.admin.enabled=true`, 이 앱은 켬)과 `authz.roles` 권한이 필요하다.
 * 만들기 · 고치기 · 지우기가 끝나면 계정 화면의 「줄 수 있는 역할」을 다시 읽게 한다. 필요 없는 프로젝트는 이 파일과 라우트 한 줄을 지운다.
 */
export function AdminRolesPage() {
  const { locale } = useT()
  const client = useQueryClient()
  return (
    <AdminRoles
      api={adminRolesApi}
      labels={locale === 'ko' ? koAdminRolesLabels : undefined}
      authLabels={useAuthLabels()}
      onChanged={() => void client.invalidateQueries({ queryKey: assignableRolesKey })}
    />
  )
}
