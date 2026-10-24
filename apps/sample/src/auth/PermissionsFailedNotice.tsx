import { mergeLabels, useAuth } from '@skeleton/auth'
import { Alert, Button } from '@skeleton/ui'
import { useAuthLabels } from './useAuthLabels'

/** `RequirePermission` 의 `failed` - 권한을 받으려다 멈췄을 때 현재 언어로 안내하고 「다시 시도」로 다시 묻는다 */
export function PermissionsFailedNotice() {
  const { retryPermissions } = useAuth()
  const labels = mergeLabels(useAuthLabels())
  return (
    <Alert
      tone="danger"
      action={
        <Button variant="secondary" size="sm" onClick={retryPermissions}>
          {labels.permissionsRetry}
        </Button>
      }
    >
      {labels.permissionsLoadFailed}
    </Alert>
  )
}
