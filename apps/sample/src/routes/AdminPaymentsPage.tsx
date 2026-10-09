import {
  adminAccessProblem,
  AdminOrderTable,
  RefundRequestTable,
  useAdminOrders,
  useAdminRefundRequests,
  useRefundDecision,
} from '@skeleton/payment/admin'
import type { AdminOrderFilter } from '@skeleton/payment/admin'
import { PageHeader, Tabs } from '@skeleton/ui'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { paymentLabelsFor } from '../cheer/paymentLabels'
import { languageOf, useT } from '../i18n'
import { AdminAccessNotice } from '../paymentAdmin/AdminAccessNotice'
import { paymentAdminApi } from '../paymentAdmin/api'
import { ordersParamsOf } from './adminOrdersParams'
import styles from './AdminPaymentsPage.module.css'

export const ADMIN_PAYMENTS_PAGE_SIZE = 20
const TABS = ['all', 'review', 'refunds'] as const
type Tab = (typeof TABS)[number]
const tabOf = (value: string | null): Tab => TABS.find((tab) => tab === value) ?? 'all'

function OrdersTab({ review }: { review: boolean }) {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = paymentLabelsFor(t, language)
  const [filter, setFilter] = useState<AdminOrderFilter>({ status: '', q: '' })
  const orders = useAdminOrders(
    paymentAdminApi,
    ordersParamsOf(review, filter, ADMIN_PAYMENTS_PAGE_SIZE),
  )
  const problem = adminAccessProblem(orders.error)
  if (problem) return <AdminAccessNotice problem={problem} />
  return (
    <AdminOrderTable
      orders={orders.data?.pages.flatMap((page) => page.values) ?? []}
      filter={filter}
      onFilterChange={setFilter}
      showErasedToggle={!review}
      loading={orders.isPending}
      error={orders.isError}
      onRetry={() => void orders.refetch()}
      onLoadMore={orders.hasNextPage ? () => void orders.fetchNextPage() : undefined}
      loadingMore={orders.isFetchingNextPage}
      locale={language}
      labels={labels}
      renderAction={(order, label, accessibleName, buttonLikeClassName) => (
        <Link
          to={`/admin/payments/${encodeURIComponent(order.id)}`}
          className={buttonLikeClassName}
          aria-label={accessibleName}
        >
          {label}
        </Link>
      )}
    />
  )
}

function RefundsTab() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = paymentLabelsFor(t, language)
  const refunds = useAdminRefundRequests(paymentAdminApi, { size: ADMIN_PAYMENTS_PAGE_SIZE })
  // 요청이 환불 안 됨으로 닫히거나 결과를 모를 때 창이 결제 한 건으로 가는 길(링크)을 준다
  const decision = useRefundDecision(paymentAdminApi, {
    labels,
    locale: language,
    orderLink: (refund, buttonLikeClassName) => (
      <Link
        to={`/admin/payments/${encodeURIComponent(refund.orderId)}`}
        className={buttonLikeClassName}
      >
        {labels.admin.requests.details}
      </Link>
    ),
  })
  const problem = adminAccessProblem(refunds.error)
  if (problem) return <AdminAccessNotice problem={problem} />
  return (
    <>
      <RefundRequestTable
        refunds={refunds.data?.pages.flatMap((page) => page.values) ?? []}
        onApprove={(refund) => decision.start('approve', refund)}
        onReject={(refund) => decision.start('reject', refund)}
        loading={refunds.isPending}
        error={refunds.isError}
        onRetry={() => void refunds.refetch()}
        onLoadMore={refunds.hasNextPage ? () => void refunds.fetchNextPage() : undefined}
        loadingMore={refunds.isFetchingNextPage}
        locale={language}
        labels={labels}
        renderAction={(refund, label, accessibleName, buttonLikeClassName) => (
          <Link
            to={`/admin/payments/${encodeURIComponent(refund.orderId)}`}
            className={buttonLikeClassName}
            aria-label={accessibleName}
          >
            {label}
          </Link>
        )}
      />
      {decision.dialog}
    </>
  )
}

/**
 * Patterns/List page — 운영자 결제 목록. 탭 셋: 전체(상태 · 결제 번호로 찾기 · 「탈퇴한 계정의 결제도 보기」 스위치 - 서버는 탈퇴한 계정의 결제를 기본으로 숨긴다) · 확인 필요(결제사와 맞지 않거나 결과를 끝내 모른 결제) · 환불 요청(결정을 기다리는 것).
 * 탭은 주소(`?tab=review`)에 남아 새로 고쳐도 그대로다. 줄 끝 「자세히」 · 「결제 보기」 링크가 결제 한 건(`/admin/payments/:id`)으로 이어 주고,
 * 「요청대로 환불하기」는 확인 창을 거친다. `RequireRole` 아래 — 서버가 403 이나 404 로 답하면 각각 접근 차단 · 쓸 수 없음 안내.
 */
export function AdminPaymentsPage() {
  const { t } = useT()
  const [params, setParams] = useSearchParams()
  const tab = tabOf(params.get('tab'))
  // 고른 탭의 내용만 그린다 — 보이지 않는 탭이 목록을 따로 불러오지 않게
  const content = (id: Tab) =>
    tab !== id ? null : (
      <div className={styles.panel}>
        {id === 'refunds' ? <RefundsTab /> : <OrdersTab review={id === 'review'} />}
      </div>
    )
  return (
    <div className={styles.page}>
      <PageHeader title={t('admin.payments.title')} description={t('admin.payments.subtitle')} />
      <Tabs
        aria-label={t('admin.payments.tabsLabel')}
        value={tab}
        onValueChange={(next) => setParams(next === 'all' ? {} : { tab: next }, { replace: true })}
        items={[
          { id: 'all', label: t('admin.payments.tabAll'), content: content('all') },
          { id: 'review', label: t('admin.payments.tabReview'), content: content('review') },
          { id: 'refunds', label: t('admin.payments.tabRefunds'), content: content('refunds') },
        ]}
      />
    </div>
  )
}
