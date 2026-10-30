import { formatInstant } from '@skeleton/time'
import { Badge, Button, EmptyState, Field, Select, Table } from '@skeleton/ui'
import type { ReactNode } from 'react'
import { ADMIN_QUEUES, type AdminReview, type AdminReviewQueueName } from './types'
import { defaultReviewsAdminLabels, type ReviewsAdminLabels } from './labels'
import { allowAll, REVIEW_PERMISSIONS, type CanFn } from './permissions'
import { REPORT_REASONS } from '../types'
import styles from './AdminReviewQueue.module.css'

export type AdminReviewQueueViewProps = {
  rows: AdminReview[]
  labels?: ReviewsAdminLabels
  can?: CanFn
  queue: AdminReviewQueueName
  onQueueChange: (queue: AdminReviewQueueName) => void
  onHide: (row: AdminReview) => void
  onDismiss: (row: AdminReview) => void
  onRestore: (row: AdminReview) => void
  onReply: (row: AdminReview) => void
  /** 이 줄의 요청이 가는 중 */
  pendingId?: string | null
  locale?: string
  formatTime?: (iso: string) => string
  /** 대상(상품 …)을 그 화면으로 잇는다(라우터 링크). 없으면 글자 */
  renderTargetLink?: (row: AdminReview, children: ReactNode) => ReactNode
}

/** 본문 앞부분 — 단추의 읽는 이름에 붙여 어느 리뷰의 단추인지 알린다 */
const summaryOf = (body: string) => (body.length > 20 ? `${body.slice(0, 20)}…` : body)

/** 신고 큐 표 — 리뷰 · 사유 칩 · 상태 · 작업(숨기기 · 문제없음 · 되살리기 · 답글). 단추는 `can(key)` 와 그 줄의 상태로 갈린다 */
export function AdminReviewQueueView({
  rows,
  labels = defaultReviewsAdminLabels,
  can = allowAll,
  queue,
  onQueueChange,
  onHide,
  onDismiss,
  onRestore,
  onReply,
  pendingId = null,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  renderTargetLink,
}: AdminReviewQueueViewProps) {
  const t = labels.queue
  const canModerate = can(REVIEW_PERMISSIONS.moderate)
  const canReply = can(REVIEW_PERMISSIONS.reply)

  return (
    <div className={styles.view}>
      <div className={styles.filters}>
        <Field label={t.queueLabel}>
          {(control) => (
            <Select
              {...control}
              value={queue}
              onChange={(event) => onQueueChange(event.target.value as AdminReviewQueueName)}
            >
              {ADMIN_QUEUES.map((name) => (
                <option key={name} value={name}>
                  {t.queues[name]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Table
        caption={t.caption}
        rows={rows}
        rowKey={(row) => row.id}
        empty={<EmptyState title={t.empty[queue]} headingLevel={2} />}
        columns={[
          {
            key: 'review',
            header: t.columns.review,
            rowHeader: true,
            render: (row) => {
              const label = t.targetLink(row.targetType, row.targetId)
              return (
                <div className={styles.review}>
                  <p className={styles.meta}>
                    <span>{t.rating(row.rating)}</span>
                    <span>
                      {renderTargetLink ? renderTargetLink(row, label) : <span>{label}</span>}
                    </span>
                    {row.accountLabel && <span>{row.accountLabel}</span>}
                  </p>
                  <p className={styles.body}>{row.body}</p>
                  {row.status === 'HIDDEN' && row.moderationReason && (
                    <p className={styles.meta}>{t.hiddenReason(row.moderationReason)}</p>
                  )}
                  {row.reply && <Badge tone="info">{t.hasReply}</Badge>}
                </div>
              )
            },
          },
          {
            key: 'reports',
            header: t.columns.reports,
            render: (row) =>
              row.reportCount === 0 ? (
                t.noReports
              ) : (
                <div className={styles.reports}>
                  <strong>{t.reportCount(row.reportCount)}</strong>
                  <ul className={styles.chips}>
                    {REPORT_REASONS.filter((reason) => (row.reportReasons[reason] ?? 0) > 0).map(
                      (reason) => (
                        <li key={reason}>
                          <Badge tone="warning">
                            {t.reasonCount(t.reasons[reason], row.reportReasons[reason] ?? 0)}
                          </Badge>
                        </li>
                      ),
                    )}
                  </ul>
                  {row.lastReportedAt && (
                    <span className={styles.meta}>
                      {t.lastReported(formatTime(row.lastReportedAt))}
                    </span>
                  )}
                </div>
              ),
          },
          {
            key: 'status',
            header: t.columns.status,
            render: (row) => (
              <Badge tone={row.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                {t.status[row.status]}
              </Badge>
            ),
          },
          { key: 'when', header: t.columns.when, render: (row) => formatTime(row.createdAt) },
          {
            key: 'actions',
            header: t.columns.actions,
            render: (row) => {
              const summary = summaryOf(row.body)
              const busy = pendingId === row.id
              return (
                <div className={styles.actions}>
                  {canModerate && row.status === 'PUBLISHED' && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      aria-label={t.hideFor(summary)}
                      onClick={() => onHide(row)}
                    >
                      {t.hide}
                    </Button>
                  )}
                  {canModerate && row.status === 'PUBLISHED' && row.reportCount > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      aria-label={t.dismissFor(summary)}
                      onClick={() => onDismiss(row)}
                    >
                      {t.dismiss}
                    </Button>
                  )}
                  {canModerate && row.status === 'HIDDEN' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      aria-label={t.restoreFor(summary)}
                      onClick={() => onRestore(row)}
                    >
                      {t.restore}
                    </Button>
                  )}
                  {canReply && row.status !== 'DELETED' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={t.replyFor(summary)}
                      onClick={() => onReply(row)}
                    >
                      {t.reply}
                    </Button>
                  )}
                </div>
              )
            },
          },
        ]}
      />
    </div>
  )
}
