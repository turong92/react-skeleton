import { Alert, Badge, Button, ConfirmDialog, SettingsRow } from '@skeleton/ui'
import { useState } from 'react'
import type { AccountSession } from '../account/types'
import styles from './auth.module.css'
import { formatIp } from './formatIp'
import { mergeLabels, type AuthLabels } from './labels'
import { SectionShell } from './SectionShell'
import { SettingsDialog } from './SettingsDialog'
import { useAction } from './useAction'

export type SessionsSectionProps = {
  sessions: AccountSession[]
  onRevoke: (sessionId: string) => Promise<unknown>
  /** 이 기기만 남기고 모두 로그아웃 */
  onRevokeOthers: () => Promise<unknown>
  /** 이 앱은 연락받을 이메일을 켰다 - 모든 기기에서 로그아웃하면 그 주소도 지워진다는 한 줄을 더한다(주인의 복구 동작이 탈취된 세션이 심은 주소를 비운다) */
  contactNote?: boolean
  formatDate?: (iso: string) => string
  /** 줄만 그린다(`AccountSettings` 의 카드 안) - 아니면 제목 있는 카드 한 장에 담는다 */
  row?: boolean
  /** 첫 렌더부터 목록 대화상자가 열려 있다 - 서버 렌더 시험 · 스토리용 */
  initiallyOpen?: boolean
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
  row,
  initiallyOpen = false,
  labels: given,
}: SessionsSectionProps) {
  const labels = mergeLabels(given)
  const action = useAction(labels)
  const [open, setOpen] = useState(initiallyOpen)
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
    <SectionShell row={row} id="sessions" title={labels.sectionSessions}>
      <SettingsRow
        label={labels.sectionSessions}
        value={sessions.length > 0 ? labels.sessionsCount(sessions.length) : labels.rowNone}
        action={
          <Button
            variant="secondary"
            size="sm"
            aria-label={`${labels.sectionSessions} ${labels.rowView}`}
            onClick={() => {
              setMessage(null)
              setOpen(true)
            }}
          >
            {labels.rowView}
          </Button>
        }
        dialogs={
          <>
            <SettingsDialog
              open={open}
              onClose={() => setOpen(false)}
              title={labels.sectionSessions}
              closeLabel={labels.dialogClose}
            >
              <div className={styles.stack}>
                <p className={styles.muted}>{labels.sessionsDescription}</p>
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
                {others.length > 0 && (
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={action.busy}
                      loadingLabel={labels.submitting}
                      onClick={() => setConfirming('others')}
                    >
                      {labels.sessionsRevokeOthers}
                    </Button>
                  </div>
                )}
              </div>
            </SettingsDialog>
            <ConfirmDialog
              open={confirming !== null}
              onClose={() => setConfirming(null)}
              onConfirm={() =>
                confirming === 'others'
                  ? revoke(onRevokeOthers)
                  : confirming && revoke(() => onRevoke(confirming.id))
              }
              title={
                confirming === 'others'
                  ? labels.sessionsRevokeOthersTitle
                  : labels.sessionsRevokeTitle
              }
              description={
                confirming === 'others'
                  ? labels.sessionsRevokeOthersBody
                  : labels.sessionsRevokeBody
              }
              confirmLabel={
                confirming === 'others' ? labels.sessionsRevokeOthers : labels.sessionsRevoke
              }
              cancelLabel={labels.cancel}
              closeLabel={labels.cancel}
              tone="primary"
              busy={action.busy}
            />
          </>
        }
      />
    </SectionShell>
  )
}
