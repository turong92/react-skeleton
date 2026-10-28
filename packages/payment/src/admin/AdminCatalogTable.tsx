import { Badge, Button, Table, type TableColumn } from '@skeleton/ui'
import { formatMoney } from '../format'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import type { AdminCatalogProduct } from './catalogAdminTypes'
import { periodName, productTextOf } from './catalogText'
import { ListFrame } from './ListFrame'
import { rowActionClass, type RenderRowAction } from './rowAction'
import sharedStyles from './shared.module.css'

export type AdminCatalogTableProps = {
  products: readonly AdminCatalogProduct[]
  /** 줄 끝 「자세히」 단추를 눌렀을 때. 라우터 링크를 쓰려면 `renderAction` */
  onOpen?: (product: AdminCatalogProduct) => void
  renderAction?: RenderRowAction<AdminCatalogProduct>
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  /** 상품 이름·설명을 읽을 언어와 금액 서식(`ko-KR`) */
  locale?: string
  labels?: PaymentLabelsInput
}

/**
 * 운영자 상품 목록 - 줄마다 이름 · 코드 · 종류 · 등급 · 판매 상태 · 지금 팔리는 가격(통화별), 줄 끝에 「자세히」 단추.
 * 보이기만 한다(데이터 · 호출은 부모). 판매 중지한 상품도 보인다(알약이 말한다).
 */
export function AdminCatalogTable({
  products,
  onOpen,
  renderAction,
  loading,
  error,
  onRetry,
  locale,
  labels: input,
}: AdminCatalogTableProps) {
  const labels = resolvePaymentLabels(input)
  const text = labels.admin.catalog
  const columns: TableColumn<AdminCatalogProduct>[] = [
    {
      key: 'product',
      header: text.table.columns.product,
      rowHeader: true,
      render: (product) => (
        <span className={sharedStyles.cell}>
          <span>{productTextOf(product, locale).name}</span>
          <span className={sharedStyles.code}>{product.code}</span>
          {product.highlighted && (
            <span>
              <Badge tone="info">{text.table.highlighted}</Badge>
            </span>
          )}
        </span>
      ),
    },
    { key: 'kind', header: text.table.columns.kind, render: (p) => text.kinds[p.kind] },
    { key: 'level', header: text.table.columns.level, render: (p) => p.level ?? '' },
    {
      key: 'status',
      header: text.table.columns.status,
      render: (p) => (
        <Badge tone={p.selling ? 'success' : 'neutral'}>
          {p.selling ? text.table.selling : text.table.notSelling}
        </Badge>
      ),
    },
    {
      key: 'price',
      header: text.table.columns.price,
      render: (product) => {
        const current = product.prices.filter((price) => price.current)
        if (current.length === 0)
          return <span className={sharedStyles.muted}>{text.table.noPrice}</span>
        return (
          <span className={sharedStyles.cell}>
            {current.map((price) => (
              <span key={price.code} className={sharedStyles.amount}>
                {formatMoney(price, { locale, currencySuffix: labels.currencySuffix })}
                {price.period !== null && ` · ${periodName(price.period, text.prices)}`}
              </span>
            ))}
          </span>
        )
      },
    },
    {
      key: 'action',
      header: <span className={sharedStyles.srOnly}>{text.table.details}</span>,
      render: (product) => {
        const name = productTextOf(product, locale).name
        const accessibleName = text.table.detailsFor(name)
        if (renderAction)
          return renderAction(product, text.table.details, accessibleName, rowActionClass)
        if (!onOpen) return null
        return (
          <Button
            variant="secondary"
            size="sm"
            aria-label={accessibleName}
            onClick={() => onOpen(product)}
          >
            {text.table.details}
          </Button>
        )
      },
    },
  ]
  return (
    <ListFrame
      hasRows={products.length > 0}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={{ title: text.table.emptyTitle, description: text.table.emptyDescription }}
      labels={labels}
    >
      <Table
        caption={text.table.caption}
        columns={columns}
        rows={products}
        rowKey={(product) => product.code}
      />
    </ListFrame>
  )
}
