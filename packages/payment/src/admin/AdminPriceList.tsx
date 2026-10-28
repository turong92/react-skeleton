import { formatInstant } from '@skeleton/time'
import { Badge, Button, EmptyState, Table, type TableColumn } from '@skeleton/ui'
import { formatMoney } from '../format'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import type { AdminCatalogPrice } from './catalogAdminTypes'
import { CatalogErrorNotice } from './CatalogErrorNotice'
import { periodName } from './catalogText'
import { priceStateOf, type PriceState } from './priceState'
import { ProviderRefEditor } from './ProviderRefEditor'
import sharedStyles from './shared.module.css'
import styles from './AdminPriceList.module.css'

export type AdminPriceListProps = {
  /** 상품의 가격 전부(지난 가격까지) - 통화별로 묶어 그린다 */
  prices: readonly AdminCatalogPrice[]
  /** 「가격 더하기」 - 창을 여는 것은 부모. 주지 않으면 단추가 없다 */
  onAdd?: () => void
  /** 「판매 중지」 - 확인 창을 여는 것은 부모. 이미 멈춘 가격에는 단추가 없다 */
  onStop?: (price: AdminCatalogPrice) => void
  /** 「행사 기간 바꾸기」 - 창을 여는 것은 부모. 행사가(정가가 있는) 판매 중 줄에만 단추가 있다 */
  onChangeSale?: (price: AdminCatalogPrice) => void
  /** 가격 id 를 쓰는 켜진 결제사(`GET /providers`) - 비었거나 없으면 링크 칸이 없다 */
  providers?: readonly string[]
  /**
   * 결제사별로 가격 id 가 뜻을 갖는 통화 - 그 통화의 표에만 링크 칸이 생긴다(원화는 토스라 Paddle 가격 id 를 이을 곳이 없다).
   * 여기 없는 결제사는 모든 통화. 기본 `{ paddle: ['USD'] }`
   */
  providerCurrencies?: Readonly<Record<string, readonly string[]>>
  /** 상품이 판매 중이 아니면 `false` - 판매 중인 가격 줄도 「상품 판매 중지」로 말한다 */
  productSelling?: boolean
  onSetProviderRef?: (price: AdminCatalogPrice, provider: string, externalId: string) => void
  onRemoveProviderRef?: (price: AdminCatalogPrice, provider: string) => void
  /** 결제사 링크를 잇거나 끊다 실패한 오류 - 표 위에 이유를 띄운다(이미 다른 가격에 이어진 id 는 그 말로) */
  refError?: unknown
  /** 지금 저장 중인 링크 칸 `"<가격 코드>:<결제사>"` */
  busyRef?: string | null
  /** 상태(행사 예정 · 끝남 · 가려짐)를 가리는 기준 시각 - 기본 지금 */
  now?: Date
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

const DEFAULT_PROVIDER_CURRENCIES = { paddle: ['USD'] } as const

const TONE: Record<PriceState, 'success' | 'info' | 'neutral' | 'warning'> = {
  current: 'success',
  scheduled: 'info',
  ended: 'neutral',
  covered: 'warning',
  stopped: 'neutral',
  productStopped: 'neutral',
}

/**
 * 상품의 가격 표 - 통화별로 묶어 지금 · 예정 · 지난 가격을 한눈에(최신 먼저). 줄마다 가격 코드 · 주기 · 금액(행사면 정가 + 기간) · 상태 알약 · 「판매 중지」,
 * 결제사 링크 칸은 `providers` 가 있을 때만. 가격 줄은 고치지 않는다 - 바꾸려면 새 가격을 더하고 이전 것은 멈춘다.
 */
export function AdminPriceList({
  prices,
  onAdd,
  onStop,
  onChangeSale,
  providers = [],
  providerCurrencies = DEFAULT_PROVIDER_CURRENCIES,
  productSelling = true,
  onSetProviderRef,
  onRemoveProviderRef,
  busyRef = null,
  refError,
  now = new Date(),
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: AdminPriceListProps) {
  const labels = resolvePaymentLabels(input)
  const text = labels.admin.catalog.prices
  const money = (price: Pick<AdminCatalogPrice, 'amount' | 'currency'>) =>
    formatMoney(price, { locale, currencySuffix: labels.currencySuffix })
  const byCurrency = new Map<string, AdminCatalogPrice[]>()
  for (const price of prices)
    byCurrency.set(price.currency, [...(byCurrency.get(price.currency) ?? []), price])
  const linkable = (currency: string) =>
    onSetProviderRef && onRemoveProviderRef
      ? providers.filter(
          (p) => !(p in providerCurrencies) || providerCurrencies[p]!.includes(currency),
        )
      : []

  const columnsFor = (currency: string): TableColumn<AdminCatalogPrice>[] => [
    {
      key: 'price',
      header: text.columns.price,
      rowHeader: true,
      render: (price) => (
        <span className={sharedStyles.cell}>
          <span className={sharedStyles.code}>{price.code}</span>
          <span className={sharedStyles.muted}>{periodName(price.period, text)}</span>
        </span>
      ),
    },
    {
      key: 'amount',
      header: text.columns.amount,
      align: 'end',
      render: (price) => <span className={sharedStyles.amount}>{money(price)}</span>,
    },
    {
      key: 'sale',
      header: text.columns.sale,
      render: (price) =>
        price.compareAtAmount === null ? null : (
          <span className={sharedStyles.cell}>
            <span>
              {text.regular(money({ amount: price.compareAtAmount, currency: price.currency }))}
            </span>
            {price.saleStartsAt && (
              <span className={sharedStyles.muted}>
                {text.saleFrom(formatTime(price.saleStartsAt))}
              </span>
            )}
            {price.saleEndsAt && (
              <span className={sharedStyles.muted}>
                {text.saleUntil(formatTime(price.saleEndsAt))}
              </span>
            )}
          </span>
        ),
    },
    {
      key: 'state',
      header: text.columns.state,
      render: (price) => {
        const state = priceStateOf(price, now, productSelling)
        return <Badge tone={TONE[state]}>{text.states[state]}</Badge>
      },
    },
    ...(linkable(currency).length > 0
      ? [
          {
            key: 'links',
            header: text.links.legend,
            render: (price: AdminCatalogPrice) =>
              price.stoppedAt !== null ? null : (
                <span className={sharedStyles.cell}>
                  {linkable(currency).map((provider) => (
                    <ProviderRefEditor
                      key={provider}
                      priceCode={price.code}
                      provider={provider}
                      linked={price.providerRefs[provider]}
                      busy={busyRef === `${price.code}:${provider}`}
                      onSave={(id) => onSetProviderRef!(price, provider, id)}
                      onRemove={() => onRemoveProviderRef!(price, provider)}
                      labels={labels}
                    />
                  ))}
                </span>
              ),
          },
        ]
      : []),
    {
      key: 'action',
      header: <span className={sharedStyles.srOnly}>{text.stop}</span>,
      render: (price) => {
        const live = price.stoppedAt === null && price.selling
        return (
          <span className={sharedStyles.actions}>
            {onChangeSale &&
              live &&
              price.compareAtAmount !== null &&
              (price.saleStartsAt !== null || price.saleEndsAt !== null) && (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={text.changeSaleFor(price.code)}
                  onClick={() => onChangeSale(price)}
                >
                  {text.changeSale}
                </Button>
              )}
            {onStop && live && (
              <Button
                variant="secondary"
                size="sm"
                aria-label={text.stopFor(price.code)}
                onClick={() => onStop(price)}
              >
                {text.stop}
              </Button>
            )}
          </span>
        )
      },
    },
  ]

  return (
    <section className={styles.root} aria-label={text.heading}>
      <header className={styles.head}>
        <h2 className={styles.heading}>{text.heading}</h2>
        {onAdd && (
          <Button variant="primary" onClick={onAdd}>
            {text.add}
          </Button>
        )}
      </header>
      <CatalogErrorNotice error={refError} context="providerLink" labels={input} />
      {byCurrency.size === 0 && <EmptyState headingLevel={3} title={text.empty} />}
      {[...byCurrency].map(([currency, rows]) => (
        <div key={currency} className={styles.group}>
          <h3 className={styles.currency}>{text.currency(currency)}</h3>
          <div className={styles.scroll}>
            <Table
              caption={text.currency(currency)}
              columns={columnsFor(currency)}
              rows={rows}
              rowKey={(price) => price.code}
            />
          </div>
        </div>
      ))}
    </section>
  )
}
