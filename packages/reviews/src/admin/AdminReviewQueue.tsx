import { Alert, Button, Dialog, PageHeader, Skeleton } from '@skeleton/ui'
import { useMemo, useState, type ReactNode } from 'react'
import type { ReviewsAdminApi } from './adminApi'
import { AdminReviewQueueView } from './AdminReviewQueueView'
import { adminErrorMessage, isToolOff } from './errors'
import {
  useAdminReviewQueue,
  useDismissReports,
  useModerateReview,
  useRemoveReply,
  useSetReply,
} from './hooks'
import { HideDialog } from './HideDialog'
import { defaultReviewsAdminLabels, type ReviewsAdminLabels } from './labels'
import { allowAll, REVIEW_PERMISSIONS, type CanFn } from './permissions'
import { ReviewReplyEditor } from './ReviewReplyEditor'
import type { AdminReview, AdminReviewQueueName } from './types'
import styles from './AdminReviewQueue.module.css'

export type AdminReviewQueueProps = {
  api: Pick<
    ReviewsAdminApi,
    'listReviews' | 'moderate' | 'dismissReports' | 'setReply' | 'removeReply'
  >
  can?: CanFn
  labels?: ReviewsAdminLabels
  locale?: string
  formatTime?: (iso: string) => string
  /** 처음 보이는 큐 - 기본 신고됨 */
  initialQueue?: AdminReviewQueueName
  /** 대상(상품 …)을 그 화면으로 잇는다(라우터 링크). 없으면 글자 */
  renderTargetLink?: (row: AdminReview, children: ReactNode) => ReactNode
}

const summaryOf = (body: string) => (body.length > 40 ? `${body.slice(0, 40)}…` : body)

/**
 * 리뷰 운영 화면 — 큐(신고됨 · 숨김 · 전체) 표, 「숨기기」(사유 필수 대화상자) · 「문제없음」 · 「되살리기」 · 「답글」.
 * 백엔드 `review.moderate`(숨김 · 되살림 · 문제없음) · `review.reply`(답글). 계정 이름은 서버가 `account.read` 도 가진 운영자에게만 준다
 */
export function AdminReviewQueue({
  api,
  can = allowAll,
  labels = defaultReviewsAdminLabels,
  locale,
  formatTime,
  initialQueue = 'reported',
  renderTargetLink,
}: AdminReviewQueueProps) {
  const [queue, setQueue] = useState<AdminReviewQueueName>(initialQueue)
  const [hiding, setHiding] = useState<AdminReview | null>(null)
  const [replying, setReplying] = useState<AdminReview | null>(null)
  const list = useAdminReviewQueue(api, queue)
  const moderate = useModerateReview(api)
  const dismiss = useDismissReports(api)
  const setReply = useSetReply(api)
  const removeReply = useRemoveReply(api)
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.values) ?? [], [list.data])
  const t = labels.queue

  // 답글 창은 큐를 다시 읽은 뒤의 최신 줄로 그린다(지우고 나서도 창이 낡은 답글을 들고 있지 않게)
  const replyingRow = replying ? (rows.find((r) => r.id === replying.id) ?? replying) : null
  const rowAction = dismiss.isError
    ? dismiss.error
    : moderate.isError && !hiding
      ? moderate.error
      : null
  const pendingId =
    (dismiss.isPending ? dismiss.variables : null) ??
    (moderate.isPending && !hiding ? (moderate.variables?.id ?? null) : null)

  return (
    <div className={styles.page}>
      <PageHeader title={t.title} />
      {rowAction && <Alert tone="danger">{adminErrorMessage(rowAction, labels)}</Alert>}
      {list.isPending ? (
        <Skeleton label={labels.loading} />
      ) : list.isError ? (
        <Alert
          tone="danger"
          action={
            isToolOff(list.error) ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void list.refetch()}>
                {labels.retry}
              </Button>
            )
          }
        >
          {isToolOff(list.error) ? labels.notEnabled : labels.loadFailed}
        </Alert>
      ) : (
        <>
          <AdminReviewQueueView
            rows={rows}
            labels={labels}
            can={can}
            queue={queue}
            onQueueChange={setQueue}
            onHide={(row) => {
              moderate.reset()
              setHiding(row)
            }}
            onDismiss={(row) => {
              dismiss.reset()
              dismiss.mutate(row.id)
            }}
            onRestore={(row) => {
              moderate.reset()
              moderate.mutate({ id: row.id, input: { status: 'PUBLISHED' } })
            }}
            onReply={setReplying}
            pendingId={pendingId}
            locale={locale}
            formatTime={formatTime}
            renderTargetLink={renderTargetLink}
          />
          {list.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                loading={list.isFetchingNextPage}
                loadingLabel={labels.loading}
                onClick={() => void list.fetchNextPage()}
              >
                {t.more}
              </Button>
            </div>
          )}
        </>
      )}
      {hiding && (
        <HideDialog
          labels={labels}
          summary={summaryOf(hiding.body)}
          busy={moderate.isPending}
          error={moderate.isError ? adminErrorMessage(moderate.error, labels) : null}
          onClose={() => {
            moderate.reset()
            setHiding(null)
          }}
          onSubmit={(reason) =>
            moderate.mutate(
              { id: hiding.id, input: { status: 'HIDDEN', reason } },
              { onSuccess: () => setHiding(null) },
            )
          }
        />
      )}
      {replyingRow && can(REVIEW_PERMISSIONS.reply) && (
        <Dialog
          open
          onClose={() => setReplying(null)}
          title={labels.replyEditor.title}
          closeLabel={labels.close}
        >
          <p className={styles.body}>{summaryOf(replyingRow.body)}</p>
          <ReviewReplyEditor
            reply={replyingRow.reply}
            labels={labels}
            onCancel={() => setReplying(null)}
            onSave={async (body) => {
              await setReply.mutateAsync({ id: replyingRow.id, body })
              setReplying(null)
            }}
            onRemove={async () => {
              await removeReply.mutateAsync(replyingRow.id)
              setReplying(null)
            }}
          />
        </Dialog>
      )}
    </div>
  )
}
