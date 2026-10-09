import { Button, Card, EmptyState, Spinner } from '@skeleton/ui'
import type { ReactNode } from 'react'
import type { PaymentLabels } from '../labelTypes'
import styles from './shared.module.css'

export type ListFrameProps = {
  hasRows: boolean
  /** 불러오는 중 — 이미 받은 줄이 있으면 줄 아래에 스피너를 더한다(줄을 지우지 않는다) */
  loading?: boolean
  /** 불러오기에 실패했다 — 이미 받은 줄이 있으면 줄 아래에 이유와 「다시 불러오기」를 더한다 */
  error?: boolean
  onRetry?: () => void
  /** 다음 쪽이 있을 때만 준다 — 「더 보기」 단추가 생긴다 */
  onLoadMore?: () => void
  loadingMore?: boolean
  /** 처음부터 줄이 없을 때 */
  empty: { title: string; description: string }
  labels: PaymentLabels
  /** 줄이 있을 때 그리는 표 */
  children: ReactNode
}

/** 운영자 세 목록의 공통 틀 — 불러오는 중 · 오류 · 비었음 · 더 보기. 받은 줄은 지우지 않는다 */
export function ListFrame({
  hasRows,
  loading,
  error,
  onRetry,
  onLoadMore,
  loadingMore,
  empty,
  labels,
  children,
}: ListFrameProps) {
  return (
    <div className={styles.list}>
      {hasRows && children}
      {loading && <Spinner label={labels.list.loading} />}
      {error && (
        <Card title={labels.admin.list.errorTitle}>
          <div role="alert" className={styles.error}>
            <p>{labels.list.errorDescription}</p>
            {onRetry && (
              <div>
                <Button variant="secondary" onClick={onRetry}>
                  {labels.list.retry}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
      {!hasRows && !loading && !error && (
        <EmptyState headingLevel={2} title={empty.title} description={empty.description} />
      )}
      {hasRows && onLoadMore && (
        <div className={styles.more}>
          <Button
            variant="secondary"
            loading={loadingMore}
            loadingLabel={labels.list.loading}
            onClick={onLoadMore}
          >
            {labels.list.loadMore}
          </Button>
        </div>
      )}
    </div>
  )
}
