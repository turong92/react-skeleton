import { Alert, Badge, Button, ConfirmDialog, SectionCard } from '@skeleton/ui'
import { useState } from 'react'
import type { AccountSession } from '../account/types'
import styles from './auth.module.css'
import { formatIp } from './formatIp'
import { mergeLabels, type AuthLabels } from './labels'
import { useAction } from './useAction'

export type SessionsSectionProps = {
  sessions: AccountSession[]
  onRevoke: (sessionId: string) => Promise<unknown>
  /** 이 기기만 남기고 모두 로그아웃 */
  onRevokeOthers: () => Promise<unknown>
  /** 이 앱은 연락받을 이메일을 켰다 - 모든 기기에서 로그아웃하면 그 주소도 지워진다는 한 줄을 더한다(주인의 복구 동작이 탈취된 세션이 심은 주소를 비운다) */
  contactNote?: boolean
  formatDate?: (iso: string) => string
  labels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleString()

/** 활성 세션 절 — 이 기기는 표시만(이 기기는 로그아웃 버튼으로), 나머지는 하나씩 · 한꺼번에 끊는다 */
export function SessionsSection({
  sessions,
  onRevoke,
  onRevokeOthers,
  contactNote = false,
  formatDate = defaultFormat,
  labels: given,
}: SessionsSectionProps) {
  const labels = mergeLabels(given)
  const action = useAction(labels)
  const [message, setMessage] = useState<string | null>(null)
  /** 확인을 기다리는 로그아웃 - 한 기기(`id`) 또는 다른 모든 기기 */
  const [confirming, setConfirming] = useState<{ id: string } | 'others' | null>(null)
  const others = sessions.filter((s) => !s.current)

  async function revoke(task: () => Promise<unknown>) {
    setMessage(null)
    if (await action.run(task)) setMessage(labels.sessionsRevoked)
    setConfirming(null)
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
            onClick={() => setConfirming('others')}
          >
            {labels.sessionsRevokeOthers}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.stack}>
        {action.error && <Alert tone="danger">{action.error.message}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}
        {contactNote && <p className={styles.muted}>{labels.sessionsContactNote}</p>}
        {sessions.length === 0 && <p className={styles.muted}>{labels.sessionsEmpty}</p>}
        <ul className={styles.list}>
          {sessions.map((session) => (
            <li key={session.id} className={styles.item}>
              <div className={styles.itemText}>
                <strong>{session.deviceName ?? labels.sessionsUnknownDevice}</strong>
                <span className={styles.muted}>
                  {[
                    formatIp(session.ip, labels.sessionsLocalDevice),
                    labels.sessionsLastUsed(formatDate(session.lastUsedAt)),
                  ]
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
                  onClick={() => setConfirming({ id: session.id })}
                >
                  {labels.sessionsRevoke}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() =>
          confirming === 'others'
            ? revoke(onRevokeOthers)
            : confirming && revoke(() => onRevoke(confirming.id))
        }
        title={
          confirming === 'others' ? labels.sessionsRevokeOthersTitle : labels.sessionsRevokeTitle
        }
        description={
          confirming === 'others' ? labels.sessionsRevokeOthersBody : labels.sessionsRevokeBody
        }
        confirmLabel={confirming === 'others' ? labels.sessionsRevokeOthers : labels.sessionsRevoke}
        cancelLabel={labels.cancel}
        closeLabel={labels.cancel}
        tone="primary"
        busy={action.busy}
      />
    </SectionCard>
  )
}
