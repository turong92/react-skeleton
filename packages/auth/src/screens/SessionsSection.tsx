import { Alert, Badge, Button, SectionCard } from '@skeleton/ui'
import { useState } from 'react'
import type { AccountSession } from '../account/types'
import styles from './auth.module.css'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type SessionsSectionProps = {
  sessions: AccountSession[]
  onRevoke: (sessionId: string) => Promise<unknown>
  /** 이 기기만 남기고 모두 로그아웃 */
  onRevokeOthers: () => Promise<unknown>
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleString()

/** 활성 세션 절 — 이 기기는 표시만(이 기기는 로그아웃 버튼으로), 나머지는 하나씩 · 한꺼번에 끊는다 */
export function SessionsSection({
  sessions,
  onRevoke,
  onRevokeOthers,
  formatDate = defaultFormat,
  labels: given,
}: SessionsSectionProps) {
  const labels = mergeLabels(given)
  const action = useAction(labels)
  const [message, setMessage] = useState<string | null>(null)
  const others = sessions.filter((s) => !s.current)

  async function revoke(task: () => Promise<unknown>) {
    setMessage(null)
    if (await action.run(task)) setMessage(labels.sessionsRevoked)
  }

  return (
    <SectionCard
      id="sessions"
      title={labels.sectionSessions}
      description={labels.sessionsDescription}
      aside={
        others.length > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            loading={action.busy}
            loadingLabel={labels.submitting}
            onClick={() => revoke(onRevokeOthers)}
          >
            {labels.sessionsRevokeOthers}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.stack}>
        {action.error && <Alert tone="danger">{action.error.message}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}
        {sessions.length === 0 && <p className={styles.muted}>{labels.sessionsEmpty}</p>}
        <ul className={styles.list}>
          {sessions.map((session) => (
            <li key={session.id} className={styles.item}>
              <div className={styles.itemText}>
                <strong>{session.deviceName ?? labels.sessionsUnknownDevice}</strong>
                <span className={styles.muted}>
                  {[session.ip, labels.sessionsLastUsed(formatDate(session.lastUsedAt))]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {session.current ? (
                <Badge tone="info">{labels.sessionsCurrent}</Badge>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={action.busy}
                  onClick={() => revoke(() => onRevoke(session.id))}
                >
                  {labels.sessionsRevoke}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  )
}
