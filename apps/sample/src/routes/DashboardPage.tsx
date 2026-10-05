import { useAuth } from '@skeleton/auth'
import { NotificationList, useMarkRead, useNotifications } from '@skeleton/notifications'
import { formatRelative } from '@skeleton/time'
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  Stat,
  Table,
  type TableColumn,
} from '@skeleton/ui'
import { Link, useNavigate } from 'react-router-dom'
import { LoadError } from '../components/LoadError'
import { NoteStatusBadge } from '../components/NoteStatusBadge'
import { notificationsApi } from '../notifications/api'
import { useNotes, useNoteSummary } from '../notes/queries'
import type { Note } from '../notes/types'
import { strings } from '../strings'
import styles from './DashboardPage.module.css'

const t = strings.dashboard

const columns: TableColumn<Note>[] = [
  {
    key: 'title',
    header: strings.notes.columnTitle,
    rowHeader: true,
    render: (note) => <Link to={`/notes/${note.id}`}>{note.title}</Link>,
  },
  {
    key: 'status',
    header: strings.notes.columnStatus,
    render: (n) => <NoteStatusBadge status={n.status} />,
  },
  {
    key: 'updated',
    header: strings.notes.columnUpdated,
    render: (n) => formatRelative(n.updatedAt),
  },
]

/** Patterns/Dashboard page — 현황 타일 · 최근 노트(표 + 빈 · 로딩 · 오류) · 안 읽은 알림 */
export function DashboardPage() {
  const { principal } = useAuth()
  const navigate = useNavigate()
  const summary = useNoteSummary()
  const recent = useNotes({ page: 0, size: 5 })
  const unread = useNotifications(notificationsApi, { unreadOnly: true, size: 3 })
  const markRead = useMarkRead(notificationsApi)
  const name = principal?.username ?? principal?.email ?? principal?.accountId ?? ''
  const create = <Button onClick={() => navigate('/notes/new')}>{t.create}</Button>

  const stats = summary.data
  const noNotes = recent.data !== undefined && recent.data.pagination.totalElements === 0

  return (
    <div className={styles.page}>
      <PageHeader title={t.greeting(name)} description={t.subtitle} actions={create} />

      {summary.isError ? (
        <LoadError onRetry={() => void summary.refetch()} />
      ) : (
        <section className={styles.stats} aria-label={t.statsLabel}>
          <Link to="/notes" className={styles.statLink}>
            <Stat label={t.statTotal} value={stats?.total ?? '—'} hint={t.statHint} />
          </Link>
          <Link to="/notes?pinned=true" className={styles.statLink}>
            <Stat label={t.statPinned} value={stats?.pinned ?? '—'} hint={t.statHint} />
          </Link>
          <Link to="/notes?status=DRAFT" className={styles.statLink}>
            <Stat label={t.statDraft} value={stats?.draft ?? '—'} hint={t.statHint} />
          </Link>
          <Link to="/notes" className={styles.statLink}>
            <Stat label={t.statAttachment} value={stats?.withAttachment ?? '—'} hint={t.statHint} />
          </Link>
        </section>
      )}

      <div className={styles.columns}>
        <div className={styles.recent}>
          {recent.isPending && <Spinner label={strings.common.loading} />}
          {recent.isError && <LoadError onRetry={() => void recent.refetch()} />}
          {recent.data && (
            <>
              {/* 표는 자기 면과 제목(caption)이 있다 — Card 로 한 번 더 감싸지 않는다 */}
              <Table
                caption={t.recentTitle}
                columns={columns}
                rows={recent.data.values}
                rowKey={(note) => note.id}
                empty={
                  <EmptyState
                    headingLevel={2}
                    title={t.emptyTitle}
                    description={t.emptyBody}
                    action={create}
                  />
                }
              />
              {!noNotes && (
                <Link to="/notes" className={styles.more}>
                  {t.viewAll} →
                </Link>
              )}
            </>
          )}
        </div>

        <Card title={t.unreadTitle}>
          {unread.isPending && <Spinner label={strings.common.loading} />}
          {unread.isError && <LoadError onRetry={() => void unread.refetch()} />}
          {unread.data && (
            <NotificationList
              items={unread.data.values}
              onRead={(item) => markRead.mutate(item.eventId)}
              markReadLabel={strings.header.markRead}
              emptyTitle={t.unreadEmptyTitle}
              emptyDescription={t.unreadEmptyBody}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
