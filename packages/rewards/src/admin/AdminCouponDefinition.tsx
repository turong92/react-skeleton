import { formatInstant } from '@skeleton/time'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Skeleton,
  Stat,
  Table,
} from '@skeleton/ui'
import { useId, useState, type ReactNode } from 'react'
import { stageSummary } from '../coupon/stageSummary'
import { formatMoney } from '../format'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { CouponStatus } from '../types'
import type { RewardsAdminApi } from './adminApi'
import { adminErrorMessage, isToolOff, mergeAdminLabels } from './adminErrors'
import {
  useAdminCouponDefinitions,
  useCouponDefinitionMutations,
  useCouponStats,
  useDefinitionCoupons,
} from './hooks'
import type { RewardsAdminLabels } from './labels'
import { allowAll, REWARDS_PERMISSIONS, type CanFn } from './permissions'
import type { CouponDefinition } from './types'
import styles from './AdminCouponDefinition.module.css'

export type AdminCouponDefinitionProps = {
  api: Pick<
    RewardsAdminApi,
    | 'listCouponDefinitions'
    | 'couponStats'
    | 'listDefinitionCoupons'
    | 'revokeCoupon'
    | 'createCouponDefinition'
    | 'setCouponDefinitionStatus'
    | 'issueCoupons'
    | 'createCouponCode'
  >
  definitionId: string
  can?: CanFn
  labels?: Partial<RewardsAdminLabels>
  /** 혜택 · 상태 문구의 사용자 사전 */
  userLabels?: RewardsLabels
  locale?: string
  formatTime?: (iso: string) => string
  /** 제목 위 자리 - 「쿠폰 목록으로」 링크 */
  back?: ReactNode
  /** 계정 칸을 그 계정 화면으로 잇는다(라우터 링크). 없으면 글자 */
  renderAccountLink?: (accountId: string, children: ReactNode) => ReactNode
}

const STATUSES: readonly CouponStatus[] = ['AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'REVOKED']
const TONE = {
  AVAILABLE: 'success',
  RESERVED: 'info',
  USED: 'neutral',
  EXPIRED: 'warning',
  REVOKED: 'danger',
} as const

/**
 * 쿠폰 정의 한 건 - 혜택 · 상태 · 발행 기간 · 사용 기간, 현황 카드(발급 · 사용 가능 · 사용 중 · 사용함 · 만료 · 회수 · 깎아 준 금액),
 * 발급 내역 표(상태 걸러 보기 · 「더 보기」 · 쓸 수 있는 쿠폰의 「회수」). 백엔드 `coupon.manage`
 */
export function AdminCouponDefinition({
  api,
  definitionId,
  can = allowAll,
  labels: given,
  userLabels = defaultRewardsLabels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  back,
  renderAccountLink,
}: AdminCouponDefinitionProps) {
  const labels = mergeAdminLabels(given)
  const t = labels.couponDetail
  const allowed = can(REWARDS_PERMISSIONS.coupon)
  const issuedTitleId = useId()
  const [status, setStatus] = useState<CouponStatus | ''>('')
  const definitions = useAdminCouponDefinitions(api)
  const stats = useCouponStats(api, definitionId)
  const issued = useDefinitionCoupons(api, definitionId, status)
  const { revoke } = useCouponDefinitionMutations(api)
  const definition = definitions.data?.find((d) => d.id === definitionId)
  const money = (amount: number, currency: string) =>
    formatMoney(amount, currency, { locale, currencySuffix: userLabels.coupon.currencySuffix })

  if (definitions.isPending) return <Skeleton lines={4} label={labels.loading} />
  if (definitions.isError)
    return (
      <Alert tone="danger">
        {isToolOff(definitions.error) ? labels.errors.notEnabled : labels.loadFailed}
      </Alert>
    )
  if (!definition)
    return (
      <div className={styles.page}>
        {back && <div>{back}</div>}
        <EmptyState title={t.notFound} headingLevel={2} />
      </div>
    )

  const rows = issued.data?.pages.flatMap((page) => page.values) ?? []
  const account = (id: string) => (renderAccountLink ? renderAccountLink(id, id) : id)

  return (
    <div className={styles.page}>
      <PageHeader title={definition.name} back={back} />
      <Card>
        <dl className={styles.facts}>
          <Fact label={t.status}>
            <Badge>{labels.coupons.status[definition.status]}</Badge>
          </Fact>
          <Fact label={t.benefit}>
            {stageSummary(definition.stages, userLabels.coupon, {
              currency: definition.currency,
              locale,
            })}
          </Fact>
          <Fact label={t.issuePeriod}>
            {periodText(definition.issueStartsAt, definition.issueEndsAt, t, formatTime)}
          </Fact>
          <Fact label={t.usePeriod}>{validPeriodText(definition, t, formatTime)}</Fact>
        </dl>
      </Card>

      <Card title={t.stats.title}>
        {stats.isPending ? (
          <Skeleton lines={2} label={labels.loading} />
        ) : stats.isError ? (
          <Alert tone="danger">{labels.loadFailed}</Alert>
        ) : (
          <div className={styles.stats}>
            {(['issued', 'available', 'reserved', 'used', 'expired', 'revoked'] as const).map(
              (key) => (
                <Stat
                  key={key}
                  label={t.stats[key]}
                  value={new Intl.NumberFormat(locale).format(stats.data[key])}
                />
              ),
            )}
            <Stat
              label={t.stats.discountTotal}
              value={
                stats.data.discountTotals.length === 0
                  ? t.stats.noDiscount
                  : stats.data.discountTotals.map((d) => money(d.amount, d.currency)).join(' · ')
              }
            />
          </div>
        )}
      </Card>

      <section className={styles.issued} aria-labelledby={issuedTitleId}>
        <h2 id={issuedTitleId}>{t.issuedList.title}</h2>
        <Field label={t.issuedList.statusFilter}>
          {(control) => (
            <Select
              {...control}
              value={status}
              onChange={(event) => setStatus(event.target.value as CouponStatus | '')}
            >
              <option value="">{t.issuedList.all}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {userLabels.coupon.status[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {revoke.isError && <Alert tone="danger">{adminErrorMessage(revoke.error, labels)}</Alert>}
        {issued.isPending ? (
          <Skeleton label={labels.loading} />
        ) : issued.isError ? (
          <Alert
            tone="danger"
            action={
              <Button variant="secondary" size="sm" onClick={() => void issued.refetch()}>
                {labels.retry}
              </Button>
            }
          >
            {labels.loadFailed}
          </Alert>
        ) : (
          <>
            {/* 상태를 바꾼 직후에는 새로 오는 동안 앞 목록이 흐리게 보인다 */}
            <div
              className={issued.isPlaceholderData ? styles.stale : undefined}
              aria-busy={issued.isPlaceholderData}
            >
              <Table
                caption={t.issuedList.caption}
                rows={rows}
                rowKey={(coupon) => coupon.id}
                empty={<EmptyState title={t.issuedList.empty} headingLevel={3} />}
                columns={[
                  {
                    key: 'account',
                    header: t.issuedList.columns.account,
                    rowHeader: true,
                    render: (coupon) => account(coupon.accountId),
                  },
                  {
                    key: 'status',
                    header: t.issuedList.columns.status,
                    render: (coupon) => (
                      <Badge tone={TONE[coupon.status]}>
                        {userLabels.coupon.status[coupon.status]}
                      </Badge>
                    ),
                  },
                  {
                    key: 'issuedAt',
                    header: t.issuedList.columns.issuedAt,
                    render: (coupon) => formatTime(coupon.issuedAt),
                  },
                  {
                    key: 'expiresAt',
                    header: t.issuedList.columns.expiresAt,
                    render: (coupon) => (coupon.expiresAt ? formatTime(coupon.expiresAt) : '-'),
                  },
                  {
                    key: 'usedAt',
                    header: t.issuedList.columns.usedAt,
                    render: (coupon) => (coupon.usedAt ? formatTime(coupon.usedAt) : '-'),
                  },
                  {
                    key: 'order',
                    header: t.issuedList.columns.order,
                    render: (coupon) => coupon.orderRef ?? '-',
                  },
                  {
                    key: 'actions',
                    header: t.issuedList.columns.actions,
                    render: (coupon) =>
                      allowed &&
                      coupon.status === 'AVAILABLE' && (
                        <Button
                          variant="danger"
                          size="sm"
                          aria-label={t.issuedList.revoke(coupon.accountId)}
                          loading={revoke.isPending && revoke.variables === coupon.id}
                          loadingLabel={labels.loading}
                          onClick={() => revoke.mutate(coupon.id)}
                        >
                          {labels.coupons.revokeButton}
                        </Button>
                      ),
                  },
                ]}
              />
            </div>
            {issued.hasNextPage && (
              <div>
                <Button
                  variant="secondary"
                  loading={issued.isFetchingNextPage}
                  loadingLabel={labels.loading}
                  onClick={() => void issued.fetchNextPage()}
                >
                  {t.issuedList.more}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

type DetailLabels = RewardsAdminLabels['couponDetail']

/** 「시작 ~ 끝」 - 한쪽만 있으면 「○○부터」 · 「○○까지」, 둘 다 없으면 제한 없음 */
function periodText(
  from: string | null | undefined,
  to: string | null | undefined,
  t: DetailLabels,
  format: (iso: string) => string,
): string {
  if (!from && !to) return t.always
  if (from && to) return `${format(from)} ~ ${format(to)}`
  return from ? t.from(format(from)) : t.until(format(to as string))
}

/** 사용 기간 - 사용 시작 · 고정 끝 · 받은 날부터 N일(이른 쪽이 이긴다) */
function validPeriodText(
  definition: CouponDefinition,
  t: DetailLabels,
  format: (iso: string) => string,
): string {
  const range = periodText(definition.validFrom, definition.validUntil, t, format)
  const days = definition.validDays !== null ? t.validDays(definition.validDays) : null
  if (days === null) return range === t.always ? t.noEnd : range
  return range === t.always ? days : `${range}, ${days}`
}
