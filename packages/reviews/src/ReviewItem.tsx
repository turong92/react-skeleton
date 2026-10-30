import { formatInstant } from '@skeleton/time'
import { Alert, Badge, Button, ConfirmDialog, RowMenu, type RowMenuItem } from '@skeleton/ui'
import { useState, type ReactNode } from 'react'
import type { ReviewsLabels } from './labels'
import { RatingStars } from './RatingStars'
import { ReportDialog } from './ReportDialog'
import {
  REPORT_REASONS,
  type ReportInput,
  type ReportReason,
  type Review,
  type ReviewPhoto,
} from './types'
import styles from './ReviewItem.module.css'

export type ReviewItemProps = {
  review: Review
  labels: ReviewsLabels
  locale?: string
  formatTime?: (iso: string) => string
  /** 도움돼요 누르기 · 떼기. 없으면(로그인 전) 숫자만 보인다 - 내 리뷰는 서버가 403 이라 늘 숫자만 */
  onToggleHelpful?: (review: Review, helpful: boolean) => void
  /** 이 줄의 도움돼요 요청이 가는 중 */
  helpfulPending?: boolean
  /** 신고 보내기. 없으면 남의 리뷰에 ⋯ 메뉴가 없다 */
  onReport?: (review: Review, input: ReportInput) => Promise<unknown> | void
  /** 서버가 허용하는 사유(`config.reportReasons`). 기본 전부 */
  reportReasons?: ReportReason[]
  /** 내 리뷰 고치기 - 폼을 여는 것은 앱의 몫이다. 숨겨진 리뷰에는 나오지 않는다 */
  onEdit?: (review: Review) => void
  /** 내 리뷰 지우기(확인 창 뒤에) */
  onDelete?: (review: Review) => Promise<unknown> | void
  /** 사진 한 칸을 그린다 - 패키지는 파일이 어디 있는지 모른다. 안 주면 「사진 1」 이름표 */
  renderPhoto?: (photo: ReviewPhoto, review: Review) => ReactNode
}

const authorOf = (review: Review, labels: ReviewsLabels['item']) =>
  review.authorDeleted
    ? labels.authorDeleted
    : review.authorName
      ? review.authorTag
        ? `${review.authorName}#${review.authorTag}`
        : review.authorName
      : labels.anonymous

/** 리뷰 한 줄 — 별 · 작성자 · 구매 인증 · 본문 · 사진 · 운영자 답글 · 도움돼요 · ⋯ 메뉴(신고 / 고치기 · 지우기) */
export function ReviewItem({
  review,
  labels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  onToggleHelpful,
  helpfulPending = false,
  onReport,
  reportReasons = [...REPORT_REASONS],
  onEdit,
  onDelete,
  renderPhoto,
}: ReviewItemProps) {
  const t = labels.item
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeBusy, setRemoveBusy] = useState(false)
  const author = authorOf(review, t)
  const hidden = review.mine && review.status === 'HIDDEN'

  const items: RowMenuItem[] = []
  if (review.mine) {
    if (onEdit && !hidden)
      items.push({ key: 'edit', label: t.edit, onSelect: () => onEdit(review) })
    if (onDelete)
      items.push({
        key: 'remove',
        label: t.remove,
        danger: true,
        onSelect: () => setRemoving(true),
      })
  } else if (onReport) {
    items.push({ key: 'report', label: t.report, onSelect: () => setReporting(true) })
  }

  const canHelp = onToggleHelpful !== undefined && !review.mine && !hidden

  return (
    <article className={styles.item} data-status={review.status}>
      <header className={styles.head}>
        <RatingStars value={review.rating} size="sm" labels={labels} locale={locale} />
        <span className={styles.author}>{author}</span>
        {review.verified && <Badge tone="success">{t.verified}</Badge>}
        <time dateTime={review.createdAt} className={styles.time}>
          {formatTime(review.createdAt)}
        </time>
        {review.edited && <span className={styles.time}>{t.edited}</span>}
        {items.length > 0 && (
          <span className={styles.menu}>
            <RowMenu label={t.menu(author)} items={items} />
          </span>
        )}
      </header>

      {hidden && (
        <Alert tone="warning">
          <p className={styles.noticeLine}>{t.hiddenMine}</p>
          {review.moderationReason && (
            <p className={styles.noticeLine}>{t.hiddenReason(review.moderationReason)}</p>
          )}
        </Alert>
      )}

      <p className={hidden ? styles.hiddenBody : styles.body}>{review.body}</p>

      {review.photos.length > 0 && (
        <ul className={styles.photos} aria-label={t.photos}>
          {review.photos.map((photo) => (
            <li key={photo.index} className={styles.photo}>
              {renderPhoto ? renderPhoto(photo, review) : t.photo(photo.index + 1)}
            </li>
          ))}
        </ul>
      )}

      {review.reply && (
        <section className={styles.reply} aria-label={t.reply}>
          <p className={styles.replyTitle}>{t.reply}</p>
          <p className={styles.body}>{review.reply.body}</p>
          <time dateTime={review.reply.createdAt} className={styles.time}>
            {formatTime(review.reply.createdAt)}
          </time>
        </section>
      )}

      {!hidden && (
        <footer className={styles.foot}>
          {canHelp ? (
            <Button
              variant="secondary"
              size="sm"
              aria-pressed={review.helpful}
              disabled={helpfulPending}
              className={styles.helpful}
              onClick={() => onToggleHelpful(review, !review.helpful)}
            >
              {review.helpful ? '✓ ' : ''}
              {t.helpful(review.helpfulCount)}
            </Button>
          ) : (
            review.helpfulCount > 0 && (
              <span className={styles.time}>{t.helpfulCount(review.helpfulCount)}</span>
            )
          )}
          {reported && (
            <span role="status" className={styles.time}>
              {labels.report.sent}
            </span>
          )}
        </footer>
      )}

      {reporting && onReport && (
        <ReportDialog
          open
          labels={labels}
          reasons={reportReasons}
          onClose={() => setReporting(false)}
          onSubmit={async (input) => {
            await onReport(review, input)
            setReporting(false)
            setReported(true)
          }}
        />
      )}
      {removing && onDelete && (
        <ConfirmDialog
          open
          title={t.removeTitle}
          description={t.removeBody}
          confirmLabel={t.removeConfirm}
          cancelLabel={t.cancel}
          closeLabel={t.close}
          loadingLabel={labels.loading}
          busy={removeBusy}
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            setRemoveBusy(true)
            try {
              await onDelete(review)
              setRemoving(false)
            } catch {
              // 창은 그대로 - 오류 토스트는 전역 핸들러가 띄운다
            } finally {
              setRemoveBusy(false)
            }
          }}
        />
      )}
    </article>
  )
}
