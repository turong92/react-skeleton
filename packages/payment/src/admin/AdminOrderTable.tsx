import { formatInstant } from '@skeleton/time'
import { Badge, Button, Field, Input, Select, Switch, Table, type TableColumn } from '@skeleton/ui'
import { useState } from 'react'
import { cardDisplay, formatMoney, lookup } from '../format'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import type { OrderStatus } from '../ledgerTypes'
import { OrderStatusBadge } from '../OrderStatusBadge'
import { isErasedAccount } from './erasedAccount'
import { ListFrame } from './ListFrame'
import { rowActionClass, type RenderRowAction } from './rowAction'
import sharedStyles from './shared.module.css'
import styles from './AdminOrderTable.module.css'
import type { AdminOrder } from './types'

/**
 * 목록 조건 — 상태 `''` 는 모든 상태, `q` 는 결제 번호 또는 결제사 결제 번호의 정확한 값(`''` 는 조건 없음).
 * `includeErased` 는 탈퇴한 계정의 결제도 보기(서버는 기본으로 숨긴다) - 없으면 꺼짐
 */
export type AdminOrderFilter = { status: OrderStatus | ''; q: string; includeErased?: boolean }

export type AdminOrderTableProps = {
  orders: readonly AdminOrder[]
  /** 줄 끝 「자세히」 단추를 눌렀을 때. 라우터 링크를 쓰려면 `renderAction` */
  onOpen?: (order: AdminOrder) => void
  renderAction?: RenderRowAction<AdminOrder>
  /** 주면 표 위에 조건 줄(상태 고르기 · 결제 번호 찾기)이 생긴다. 바뀌면 부모가 목록을 다시 읽는다 */
  filter?: AdminOrderFilter
  onFilterChange?: (next: AdminOrderFilter) => void
  /**
   * 조건 줄 아래에 스위치 「탈퇴한 계정의 결제도 보기」를 둔다(`filter` 가 있을 때). 서버는 이 결제들을 전체 목록에서 기본으로 숨기고, 결제 번호로 정확히 찾을 때와
   * 확인 필요 목록에서는 늘 보여 준다 - 그래서 확인 필요 탭에서는 주지 않는다
   */
  showErasedToggle?: boolean
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  onLoadMore?: () => void
  loadingMore?: boolean
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

const STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'CONFIRMING',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'EXPIRED',
  'CANCELED',
]

/**
 * 운영자 결제 목록 — 줄마다 이름 · 결제 번호 · 금액 · 결제 수단 · 상태 알약(+ 확인 필요 알약과 사유) · 시각, 줄 끝에 「자세히」 단추.
 * 보이기만 한다(데이터 · 쪽 이동 · 호출은 부모). 줄 전체는 눌리지 않고 알약도 눌리지 않는다. 계정 id 는 이 표에 그리지 않는다(한 건 화면에서 본다).
 */
export function AdminOrderTable({
  orders,
  onOpen,
  renderAction,
  filter,
  onFilterChange,
  showErasedToggle,
  loading,
  error,
  onRetry,
  onLoadMore,
  loadingMore,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: AdminOrderTableProps) {
  const labels = resolvePaymentLabels(input)
  const text = labels.admin.orders
  // 찾는 글자는 「찾기」를 눌러야 적용된다 — 적는 동안은 초안. 부모가 조건을 바꾸면(탭을 옮김 …) 초안도 따라 바뀐다
  const applied = filter?.q ?? ''
  const [draft, setDraft] = useState(applied)
  const [seen, setSeen] = useState(applied)
  if (applied !== seen) {
    setSeen(applied)
    setDraft(applied)
  }
  const filtering = Boolean(filter && (filter.status !== '' || filter.q !== ''))

  const columns: TableColumn<AdminOrder>[] = [
    {
      key: 'payment',
      header: text.columns.payment,
      rowHeader: true,
      render: (order) => (
        <span className={sharedStyles.cell}>
          <span>{order.orderName}</span>
          <span className={sharedStyles.muted}>{order.id}</span>
          {isErasedAccount(order) && (
            <span>
              <Badge tone="neutral">{labels.admin.erasedAccount}</Badge>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'amount',
      header: text.columns.amount,
      align: 'end',
      render: (order) => (
        <span className={sharedStyles.amount}>
          {formatMoney(order.amount, { locale, currencySuffix: labels.currencySuffix })}
        </span>
      ),
    },
    {
      key: 'method',
      header: text.columns.method,
      render: (order) => cardDisplay(order, labels),
    },
    {
      key: 'status',
      header: text.columns.status,
      render: (order) => {
        const reason = order.reviewReason
        return (
          <span className={sharedStyles.cell}>
            <span className={styles.flags}>
              <OrderStatusBadge
                status={order.status}
                openRefundStatus={order.openRefundStatus}
                labels={input}
              />
              {reason && <Badge tone="warning">{labels.unknownStatus}</Badge>}
            </span>
            {reason && (
              <span className={sharedStyles.muted}>
                {lookup(labels.admin.reviewReason, reason) ?? labels.admin.reviewUnknown}
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'time',
      header: text.columns.time,
      render: (order) => formatTime(order.paidAt ?? order.createdAt),
    },
    {
      key: 'action',
      header: <span className={sharedStyles.srOnly}>{text.details}</span>,
      render: (order) => {
        const accessibleName = text.detailsFor(order.orderName)
        if (renderAction) return renderAction(order, text.details, accessibleName, rowActionClass)
        if (!onOpen) return null
        return (
          <Button
            variant="secondary"
            size="sm"
            aria-label={accessibleName}
            onClick={() => onOpen(order)}
          >
            {text.details}
          </Button>
        )
      },
    },
  ]

  const form = filter && onFilterChange && (
    <form
      role="search"
      aria-label={text.filterLabel}
      className={styles.filter}
      onSubmit={(event) => {
        event.preventDefault()
        onFilterChange({ ...filter, q: draft.trim() })
      }}
    >
      <Field label={text.statusFilter}>
        {(control) => (
          <Select
            {...control}
            value={filter.status}
            onChange={(event) =>
              onFilterChange({
                ...filter,
                status: event.target.value as OrderStatus | '',
                q: applied,
              })
            }
          >
            <option value="">{text.statusAll}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {labels.orderStatus[status]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className={styles.search}>
        <Field label={text.search} hint={text.searchHint}>
          {(control) => (
            <Input
              {...control}
              value={draft}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
            />
          )}
        </Field>
      </div>
      <Button type="submit" variant="secondary" className={styles.submit}>
        {text.searchSubmit}
      </Button>
    </form>
  )

  const erasedToggle = filter && onFilterChange && showErasedToggle && (
    <Switch
      label={text.includeErased}
      description={text.includeErasedHint}
      checked={filter.includeErased === true}
      onChange={(event) => onFilterChange({ ...filter, includeErased: event.target.checked })}
    />
  )

  const list = (
    <ListFrame
      hasRows={orders.length > 0}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
      empty={
        filtering
          ? { title: text.noMatchTitle, description: text.noMatchDescription }
          : { title: text.emptyTitle, description: text.emptyDescription }
      }
      labels={labels}
    >
      <Table caption={text.caption} columns={columns} rows={orders} rowKey={(order) => order.id} />
    </ListFrame>
  )

  return form ? (
    <div className={sharedStyles.list}>
      {form}
      {erasedToggle}
      {list}
    </div>
  ) : (
    list
  )
}
