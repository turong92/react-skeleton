import { isErrorCode } from '@skeleton/api-client'
import {
  OrderSummary,
  PaymentLedgerErrorCodes,
  RefundRequestDialog,
  useOrder,
  usePaymentConfig,
  useRequestRefund,
  useWithdrawRefund,
  type OrderDetail,
} from '@skeleton/payment'
import { Alert, Button, EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { paymentApi } from '../cheer/api'
import { paymentLabelsFor } from '../cheer/paymentLabels'
import { requestedNoticeShown, startWithdraw, withdrawNoticeKey } from '../cheer/refundFlow'
import { LinkButton } from '../components/LinkButton'
import { LoadError } from '../components/LoadError'
import { PaymentFailedNotice } from '../components/PaymentFailedNotice'
import { TextLink } from '../components/TextLink'
import { languageOf, useT } from '../i18n'
import styles from './PaymentDetailPage.module.css'

/**
 * `refreshFailed` - 다시 읽기가 실패했다(데이터는 이미 있다). 방금 낸 환불 요청이 화면에 안 보일 수 있어 「환불 요청」을 막고(`stale`) 띠로 말한다 -
 * 요청은 돈이 나가지 않지만 낡은 화면에서 같은 요청을 또 내지 않게 한다. 내보낸 요청은 **낡은 화면에서만, 그 줄이 목록에 없을 때만** 상태 글자로 말한다(목록에 있으면 환불 줄이 사실을 말한다 - 요청을 거두거나 운영자가 정한 뒤 나중의 읽기가 실패해도 「환불 요청함」이 되살아나지 않게).
 */
function PaymentDetail({
  detail,
  refreshFailed,
  onRetry,
}: {
  detail: OrderDetail
  refreshFailed: boolean
  onRetry: () => void
}) {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = paymentLabelsFor(t, language)
  const config = usePaymentConfig(paymentApi)
  const requestRefund = useRequestRefund(paymentApi)
  const withdraw = useWithdrawRefund(paymentApi)
  const [asking, setAsking] = useState(false)
  const { order, refunds } = detail
  const withdrawKey = withdrawNoticeKey(withdraw)

  return (
    <div className={styles.page}>
      <PageHeader
        back={
          order.itemType === 'subscription' ? (
            <TextLink to="/subscription">← {t('subscription.title')}</TextLink>
          ) : (
            <TextLink to="/cheers">← {t('cheer.detail.back')}</TextLink>
          )
        }
        title={t('cheer.detail.title')}
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
          {t('cheer.detail.staleBody')}
        </Alert>
      )}
      {/* 방금 낸 요청은 다시 읽기가 실패한 동안에만, 그리고 그 줄이 목록에 아직 없을 때만 글자로 말한다 - 목록에 있으면 환불 줄이 사실을 말하고(요청을 거두거나 운영자가 정한 뒤에도 이 줄이 남지 않게) */}
      {requestedNoticeShown({ refreshFailed, request: requestRefund, refunds }) && (
        <p role="status" className={styles.done}>
          {labels.refundStatus.REQUESTED}
        </p>
      )}
      <OrderSummary
        order={order}
        stale={refreshFailed}
        refunds={refunds}
        refundRequestsEnabled={config.data?.refundRequestsEnabled}
        onRequestRefund={() => {
          requestRefund.reset() // 묵은 오류가 새 창에 남지 않게
          withdraw.reset() // 거절된 뒤 다시 요청할 때 옛 「이미 처리됐어요」가 새 줄 옆에 남지 않게
          setAsking(true)
        }}
        onWithdrawRefund={(refund) => startWithdraw(withdraw, refund)}
        withdrawing={withdraw.isPending}
        locale={language}
        labels={labels}
      />
      {withdrawKey && (
        <PaymentFailedNotice error={withdraw.error} labels={labels}>
          {t(withdrawKey)}
        </PaymentFailedNotice>
      )}
      <RefundRequestDialog
        open={asking}
        onClose={() => setAsking(false)}
        order={order}
        busy={requestRefund.isPending}
        error={requestRefund.error}
        onConfirm={(input) =>
          requestRefund.mutate(
            { orderId: order.id, ...input },
            { onSuccess: () => setAsking(false) },
          )
        }
        locale={language}
        labels={labels}
      />
    </div>
  )
}

/** Patterns/Detail page — 결제 한 건(금액 · 카드 · 상태 · 환불 줄)과 「환불 요청」(확인 대화상자). 남의 결제와 없는 결제는 서버가 같은 404 로 답하므로 같은 「찾을 수 없어요」 */
export function PaymentDetailPage() {
  const { t } = useT()
  const { id = '' } = useParams()
  const detail = useOrder(paymentApi, id)
  if (detail.isPending) return <Spinner label={t('common.loading')} />
  // 데이터가 있는데 다시 읽기만 실패했다면 화면을 바꾸지 않는다 - 환불 요청 창 · 오류 · 멱등 키가 `PaymentDetail` 안에 산다
  if (detail.data === undefined) {
    if (isErrorCode(detail.error, PaymentLedgerErrorCodes.ORDER_NOT_FOUND))
      return (
        <EmptyState
          headingLevel={2}
          title={t('cheer.detail.notFoundTitle')}
          description={t('cheer.detail.notFoundBody')}
          action={<LinkButton to="/cheers">{t('cheer.history.title')}</LinkButton>}
        />
      )
    return <LoadError error={detail.error} onRetry={() => void detail.refetch()} />
  }
  return (
    <PaymentDetail
      detail={detail.data}
      refreshFailed={detail.isError}
      onRetry={() => void detail.refetch()}
    />
  )
}
