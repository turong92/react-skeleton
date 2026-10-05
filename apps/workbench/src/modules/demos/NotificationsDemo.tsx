import type { ApiClient } from '@skeleton/api-client'
import { devLoginHeaders, parseDevIdentity } from '@skeleton/auth'
import {
  createNotificationsApi,
  NotificationBell,
  useNotificationIngest,
} from '@skeleton/notifications'
import { useSseClient } from '@skeleton/realtime'
import { Button, Field, Input } from '@skeleton/ui'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { skeletonWorkbenchClient } from '../workbench/skeletonWorkbenchClient'
import styles from './Demo.module.css'

/** `@skeleton/notifications` — 받은편지함(`GET/PATCH /notifications…`, 워크벤치 컨트롤러) + SSE 로 안 읽은 수 갱신 */
export function NotificationsDemo({
  client,
  identity,
  onIdentity,
}: {
  client: ApiClient
  identity: string
  onIdentity: (value: string) => void
}) {
  const api = useMemo(() => createNotificationsApi(client), [client])
  const ingest = useNotificationIngest({ onNotification: (n) => toast(n.title ?? n.type) })
  const sse = useSseClient({
    url: () => client.endpoint('/notifications/sse?topic=demo'),
    getAuthHeaders: () => devLoginHeaders(parseDevIdentity(identity)),
    onEvent: (event) => ingest(event.data),
  })
  const accountId = parseDevIdentity(identity).accountId ?? identity.trim()

  return (
    <div className={styles.stack}>
      <p className={styles.note}>
        받은편지함은 로그인한 사람의 것이다 — 아래 신원(dev-login)으로 호출한다. 알림을 보내면(받는
        사람 = 이 신원) 종의 숫자가 SSE 로 바로 올라가고, 종을 누르면 목록 · 읽음 · 모두 읽음을
        쓴다.
      </p>
      <div className={styles.row}>
        <Field label="신원 (acc_… · 이메일 · username)">
          {(control) => (
            <Input {...control} value={identity} onChange={(e) => onIdentity(e.target.value)} />
          )}
        </Field>
        <NotificationBell api={api} />
      </div>
      <div className={styles.row}>
        <Button variant="secondary" onClick={() => void sse.start()}>
          SSE 연결({sse.status})
        </Button>
        <Button variant="ghost" onClick={sse.stop}>
          끊기
        </Button>
        <Button
          onClick={() =>
            void skeletonWorkbenchClient.publishNotification(
              {
                topic: 'demo',
                type: 'demo.hello',
                recipientIds: [accountId],
                severity: 'INFO',
                title: '안녕하세요',
                message: new Date().toLocaleTimeString(),
              },
              { devLogin: parseDevIdentity(identity) },
            )
          }
        >
          알림 보내기
        </Button>
      </div>
    </div>
  )
}
