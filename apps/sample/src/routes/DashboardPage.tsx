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
import { greetingOf } from '../auth/profileDisplay'
import { useMyProfile } from '../auth/useMyProfile'
import { useT } from '../i18n'
import styles from './DashboardPage.module.css'

type Translate = ReturnType<typeof useT>['t']

function columnsOf(t: Translate): TableColumn<Note>[] {
  return [
    {
      key: 'title',
      header: t('notes.columnTitle'),
      rowHeader: true,
      render: (note) => <Link to={`/notes/${note.id}`}>{note.title}</Link>,
    },
    {
      key: 'status',
      header: t('notes.columnStatus'),
      render: (n) => <NoteStatusBadge status={n.status} />,
    },
    {
      key: 'updated',
      header: t('notes.columnUpdated'),
      render: (n) => formatRelative(n.updatedAt),
    },
  ]
}

/** Patterns/Dashboard page — 현황 타일 · 최근 노트(표 + 빈 · 로딩 · 오류) · 안 읽은 알림 */
export function DashboardPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const summary = useNoteSummary()
  const recent = useNotes({ page: 0, size: 5 })
  const unread = useNotifications(notificationsApi, { unreadOnly: true, size: 3 })
  const markRead = useMarkRead(notificationsApi)
  const { name } = greetingOf(useMyProfile().data)
  const create = <Button onClick={() => navigate('/notes/new')}>{t('dashboard.create')}</Button>

  const stats = summary.data
  const noNotes = recent.data !== undefined && recent.data.pagination.totalElements === 0

  return (
    <div className={styles.page}>
      <PageHeader
        title={name ? t('dashboard.greeting', { name }) : t('dashboard.greetingNeutral')}
        description={t('dashboard.subtitle')}
        actions={create}
      />

      {summary.isError ? (
        <LoadError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <section className={styles.stats} aria-label={t('dashboard.statsLabel')}>
          <Link to="/notes" className={styles.statLink}>
            <Stat
              label={t('dashboard.statTotal')}
              value={stats?.total ?? '—'}
              hint={t('dashboard.statHint')}
            />
          </Link>
          <Link to="/notes?pinned=true" className={styles.statLink}>
            <Stat
              label={t('dashboard.statPinned')}
              value={stats?.pinned ?? '—'}
              hint={t('dashboard.statHint')}
            />
          </Link>
          <Link to="/notes?status=DRAFT" className={styles.statLink}>
            <Stat
              label={t('dashboard.statDraft')}
              value={stats?.draft ?? '—'}
              hint={t('dashboard.statHint')}
            />
          </Link>
          <Link to="/notes" className={styles.statLink}>
            <Stat
              label={t('dashboard.statAttachment')}
              value={stats?.withAttachment ?? '—'}
              hint={t('dashboard.statHint')}
            />
          </Link>
        </section>
      )}

      <div className={styles.columns}>
        <div className={styles.recent}>
          {recent.isPending && <Spinner label={t('common.loading')} />}
          {recent.isError && (
            <LoadError error={recent.error} onRetry={() => void recent.refetch()} />
          )}
          {recent.data && (
            <>
              {/* 표는 자기 면과 제목(caption)이 있다 — Card 로 한 번 더 감싸지 않는다 */}
              <Table
                caption={t('dashboard.recentTitle')}
                columns={columnsOf(t)}
                rows={recent.data.values}
                rowKey={(note) => note.id}
                empty={
                  <EmptyState
                    headingLevel={2}
                    title={t('dashboard.emptyTitle')}
                    description={t('dashboard.emptyBody')}
                    action={create}
                  />
                }
              />
              {!noNotes && (
                <Link to="/notes" className={styles.more}>
                  {t('dashboard.viewAll')} →
                </Link>
              )}
            </>
          )}
        </div>

        <Card title={t('dashboard.unreadTitle')}>
          {unread.isPending && <Spinner label={t('common.loading')} />}
          {unread.isError && (
            <LoadError error={unread.error} onRetry={() => void unread.refetch()} />
          )}
          {unread.data && (
            <NotificationList
              items={unread.data.values}
              onRead={(item) => markRead.mutate(item.eventId)}
              markReadLabel={t('header.markRead')}
              emptyTitle={t('dashboard.unreadEmptyTitle')}
              emptyDescription={t('dashboard.unreadEmptyBody')}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
