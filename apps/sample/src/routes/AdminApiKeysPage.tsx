import { useCan } from '@skeleton/auth'
import { AdminApiKeys, koAdminApiKeysLabels } from '@skeleton/auth/admin'
import { adminApiKeysApi } from '../apiKeys/api'
import { noteScopeLabels } from '../apiKeys/scopeLabels'
import { useT } from '../i18n'

/**
 * 운영자 API 키 화면 - `@skeleton/auth/admin`(선택 내보내기). 백엔드는 `api-key` 모듈(`skeleton.api-key.admin.enabled=true`, 이 앱은 켬)과 `api-key.read` 권한이 필요하다.
 * 필요 없는 프로젝트는 이 파일과 라우트 · 메뉴 한 줄씩을 지운다.
 */
export function AdminApiKeysPage() {
  const { t, locale } = useT()
  return (
    <AdminApiKeys
      api={adminApiKeysApi}
      can={useCan()}
      scopeLabels={noteScopeLabels(t)}
      labels={locale === 'ko' ? koAdminApiKeysLabels : undefined}
    />
  )
}
