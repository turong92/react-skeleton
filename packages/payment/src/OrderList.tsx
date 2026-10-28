import { formatInstant } from '@skeleton/time'
import { Button, Card, EmptyState, Spinner } from '@skeleton/ui'
import type { ReactNode } from 'react'
import { cardDisplay, formatMoney } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { Order } from './ledgerTypes'
import { settlementOf } from './discount'
import { OrderStatusBadge, SettlementBadge } from './OrderStatusBadge'
import styles from './OrderList.module.css'

export type OrderListProps = {
  orders: readonly Order[]
  /** 줄 끝 「자세히」 단추를 눌렀을 때. 라우터 링크를 쓰려면 `renderAction` */
  onOpen?: (order: Order) => void
  /**
   * 줄 끝 컨트롤을 바꿔 끼운다(라우터의 `<Link>`) — 인자: 주문 · 보이는 글자(「자세히」) · 낭독 이름(「자세히: 주문 이름」) ·
   * **버튼 모양 클래스** — 날 `<a>` 는 밑줄도 테두리도 없는 본문 글자로 그려지니 링크의 `className` 에 이것을 꼭 붙인다
   * (`@skeleton/ui` 의 작은 보조 `Button` 과 같은 테두리 · 높이 · hover · 포커스)
   */
  renderAction?: (
    order: Order,
    label: string,
    accessibleName: string,
    buttonLikeClassName: string,
  ) => ReactNode
  /** 불러오는 중 — 이미 받은 줄이 있으면 줄 아래에 스피너를 더한다(줄을 지우지 않는다) */
  loading?: boolean
  /** 불러오기에 실패했다 — 이미 받은 줄이 있으면 줄 아래에 이유와 「다시 불러오기」를 더한다 */
  error?: boolean
  onRetry?: () => void
  /** 다음 쪽이 있을 때만 준다 — 「더 보기」 단추가 생긴다 */
  onLoadMore?: () => void
  loadingMore?: boolean
  /** 처음부터 내역이 없을 때 다음에 할 일 */
  emptyAction?: ReactNode
  /** 금액 · 시각 표기 로케일(기본은 브라우저) */
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

/**
 * 결제 내역 — 줄마다 이름(`orderName` 그대로) · 금액 · 결제 수단(「현대카드 ····1234」) · 시각 · 상태 알약, 줄 끝에 「자세히」 단추.
 * 보이기만 한다(데이터 · 쪽 이동 · 호출은 부모). 줄 전체는 눌리지 않고 상태 알약도 눌리지 않는다. 가로 스크롤 없이 줄이 접힌다.
 */
export function OrderList({
  orders,
  onOpen,
  renderAction,
  loading,
  error,
  onRetry,
  onLoadMore,
  loadingMore,
  emptyAction,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: OrderListProps) {
  const labels = resolvePaymentLabels(input)
  const hasRows = orders.length > 0
  return (
    <div className={styles.list}>
      {hasRows && (
        <ul className={styles.rows} aria-label={labels.list.caption}>
          {orders.map((order) => {
            const card = cardDisplay(order, labels)
            const accessibleName = labels.list.detailsFor(order.orderName)
            return (
              <li key={order.id} className={styles.row}>
                <div className={styles.main}>
                  <div className={styles.top}>
                    <span className={styles.name}>{order.orderName}</span>
                    <SettlementBadge settlement={settlementOf(order)} labels={input} />
                    <OrderStatusBadge
                      status={order.status}
                      openRefundStatus={order.openRefundStatus}
                      labels={input}
                    />
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.amount}>
                      {formatMoney(order.amount, {
                        locale,
                        currencySuffix: labels.currencySuffix,
                      })}
                    </span>
                    {card && <span>{card}</span>}
                    <span>{formatTime(order.paidAt ?? order.createdAt)}</span>
                  </div>
                </div>
                {renderAction ? (
                  renderAction(order, labels.list.details, accessibleName, styles.detailsLink ?? '')
                ) : onOpen ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={accessibleName}
                    onClick={() => onOpen(order)}
                  >
                    {labels.list.details}
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {loading && <Spinner label={labels.list.loading} />}
      {error && (
        <Card title={labels.list.errorTitle}>
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
        <EmptyState
          headingLevel={2}
          title={labels.list.emptyTitle}
          description={labels.list.emptyDescription}
          action={emptyAction}
        />
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
