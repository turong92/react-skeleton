import { isErrorCode } from '@skeleton/api-client'
import { PaymentLedgerErrorCodes } from '@skeleton/payment'
import {
  adminAccessProblem,
  AdminOrderPanel,
  CloseSubscriptionChargeDialog,
  heldSecondsOf,
  useAdminOrder,
  useCloseSubscriptionCharge,
  useDirectRefund,
  useRefundDecision,
  useSyncOrder,
  type AdminOrderDetail,
} from '@skeleton/payment/admin'
import { Alert, Button, EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { paymentLabelsFor } from '../cheer/paymentLabels'
import { LinkButton } from '../components/LinkButton'
import { LoadError } from '../components/LoadError'
import { TextLink } from '../components/TextLink'
import { languageOf, useT } from '../i18n'
import { AdminAccessNotice } from '../paymentAdmin/AdminAccessNotice'
import { paymentAdminApi } from '../paymentAdmin/api'
import { latestRefund } from '../paymentAdmin/latestRefund'
import { syncNoteIsStale } from '../paymentAdmin/syncedNote'
import styles from './AdminPaymentPage.module.css'

/**
 * `refreshFailed` - 다시 읽기가 실패했다(데이터는 이미 있다). 이 컴포넌트는 그대로 두고 띠만 더한다: 열린 창 · 오류 · 멱등 키가 이 안에 살기 때문에
 * 화면을 통째로 바꾸면 「결과를 모르는 오류에서 같은 키 재사용」이 깨진다. 대신 **낡았을 수 있는 화면에서는 돈이 나가는 단추를 막는다** -
 * 방금 환불이 나갔는데 재조회만 실패했다면 화면은 환불 전 그대로라서, 같은 금액을 다시 누르면 새 키라 두 번째 부분 환불이 나간다.
 * 이미 열린 창의 같은 키 재시도는 그대로다. 나간 환불은 **낡은 화면에서만** 상태 글자(「환불했어요」)로 말한다 - 다시 읽기가 성공하면 환불 줄이 사실을 말한다.
 */
function AdminPayment({
  detail,
  refreshFailed,
  onRetry,
}: {
  detail: AdminOrderDetail
  refreshFailed: boolean
  onRetry: () => void
}) {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = paymentLabelsFor(t, language)
  const { order } = detail
  const sync = useSyncOrder(paymentAdminApi)
  const closeCharge = useCloseSubscriptionCharge(paymentAdminApi)
  const [closing, setClosing] = useState(false)
  // 사유가 맞춘 응답의 사유와 달라지는 순간 맞춘 뒤의 안내를 비운다 - 한 번 갈라지면 되살아나지 않게(맞춤 → 풀림 → 같은 사유로 다시 찍혀도 거짓 「맞춰 봤지만」이 뜨지 않는다)
  const syncNoteStale = syncNoteIsStale(sync.data, order.reviewReason)
  const resetSync = sync.reset
  // 맞추는 중이면 끊지 않는다 - 보내기 전에 시작한 일의 답은 기다린다
  const dropSyncNote = () => {
    if (!sync.isPending) sync.reset()
  }
  useEffect(() => {
    if (syncNoteStale) resetSync()
  }, [syncNoteStale, resetSync])
  // 환불 · 승인 · 거절을 **보내는 순간** 맞춘 뒤의 안내를 거둔다 - 그때까지의 사실이다(결과를 모르는 환불도 돈이 나갔을 수 있고, 그 뒤에 생긴 사유에 「맞춰 봤지만」은 거짓)
  const direct = useDirectRefund(paymentAdminApi, {
    order,
    labels,
    locale: language,
    onSend: dropSyncNote,
  })
  const decision = useRefundDecision(paymentAdminApi, {
    labels,
    locale: language,
    onSend: dropSyncNote,
  })
  // 맞추기가 모름을 못 놓았다면(보낸 환불이 아직 가는 중일 수 있다) 그 말을 한다 - 다음 맞추기를 시작하면 지운다
  const [held, setHeld] = useState<number | null>(null)

  return (
    <div className={styles.page}>
      <PageHeader
        back={<TextLink to="/admin/payments">← {t('admin.payments.back')}</TextLink>}
        title={t('admin.payments.detailTitle')}
      />
      {refreshFailed && (
        <Alert
          tone="warning"
          toneLabel={labels.noticeLabel}
          title={t('common.loadFailedTitle')}
          action={
            <Button variant="secondary" onClick={onRetry}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.payments.staleBody')}
        </Alert>
      )}
      <AdminOrderPanel
        detail={detail}
        onRefund={direct.ask}
        stale={refreshFailed}
        // 상태 줄은 다시 읽기가 실패한 동안에만 보인다(패널이 `stale` 일 때) - 직접 환불과 승인 중 더 최근 것을 말한다
        refunded={latestRefund(
          { refund: direct.done, at: direct.doneAt },
          { refund: decision.approved, at: decision.approvedAt },
        )}
        onApprove={(request) => decision.start('approve', request, order.refundableAmount)}
        onReject={(request) => decision.start('reject', request, order.refundableAmount)}
        // 결제사와 맞춘 뒤에는 결과를 모르던 직접 환불을 놓는다 - 장부가 결제사와 맞았으니 환불 내역이 사실을 말한다.
        // 보낸 지 얼마 안 돼 못 놓았으면 그 사실과 남은 초를 돌려받아 화면이 말한다
        onSync={() => {
          setHeld(null)
          sync.mutate(order.id, { onSuccess: () => setHeld(heldSecondsOf(direct.forget())) })
        }}
        onCloseCharge={() => {
          closeCharge.reset() // 묵은 오류가 새로 연 창에 보이지 않게
          setClosing(true)
        }}
        syncing={sync.isPending}
        // 맞춘 응답의 사유가 지금 화면의 사유와 같을 때만 「맞춘 뒤」를 말한다
        synced={sync.data}
        // 풀린 뒤(모름이 아니게 된 뒤)에는 말하지 않는다 - 「가는 중일 수 있어요」는 잠금이 남아 있을 때만 맞다
        syncHeld={direct.unsure ? held : null}
        syncError={sync.error}
        locale={language}
        labels={labels}
      />
      <CloseSubscriptionChargeDialog
        open={closing}
        onClose={() => setClosing(false)}
        onConfirm={(confirmedAtProvider) =>
          closeCharge.mutate(
            { orderId: order.id, confirmedAtProvider },
            { onSuccess: () => setClosing(false) },
          )
        }
        busy={closeCharge.isPending}
        error={closeCharge.error}
        labels={labels}
      />
      {direct.dialog}
      {decision.dialog}
    </div>
  )
}

/**
 * Patterns/Detail page — 운영자의 결제 한 건(이력 · 환불 줄 · 직접 환불 · 요청 처리 · 「결제사와 맞추기」). 없는 결제는 「찾을 수 없어요」,
 * 서버가 403 · 404(운영자 경로가 꺼짐)로 답하면 각각 접근 차단 · 쓸 수 없음 안내(`AdminAccessNotice`).
 */
export function AdminPaymentPage() {
  const { t } = useT()
  const { id = '' } = useParams()
  const detail = useAdminOrder(paymentAdminApi, id)
  // 데이터가 있는데 다시 읽기만 실패했다면 화면을 바꾸지 않는다 - 환불 창 · 오류 · 멱등 키가 `AdminPayment` 안에 산다
  if (detail.data === undefined) {
    if (detail.isPending) return <Spinner label={t('common.loading')} />
    const problem = adminAccessProblem(detail.error)
    if (problem) return <AdminAccessNotice problem={problem} />
    if (isErrorCode(detail.error, PaymentLedgerErrorCodes.ORDER_NOT_FOUND))
      return (
        <EmptyState
          headingLevel={2}
          title={t('admin.payments.notFoundTitle')}
          description={t('admin.payments.notFoundBody')}
          action={<LinkButton to="/admin/payments">{t('admin.payments.back')}</LinkButton>}
        />
      )
    return <LoadError error={detail.error} onRetry={() => void detail.refetch()} />
  }
  return (
    <AdminPayment
      key={id}
      detail={detail.data}
      refreshFailed={detail.isError}
      onRetry={() => void detail.refetch()}
    />
  )
}
