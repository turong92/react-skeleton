import {
  PaymentResult,
  TestModeNotice,
  useAbandonOrder,
  useConfirmOrder,
  useOrder,
  usePaymentConfig,
} from '@skeleton/payment'
import { Button, EmptyState, PageHeader } from '@skeleton/ui'
import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { paymentApi } from '../cheer/api'
import { returnPlanOf, type ReturnPlan } from '../cheer/checkoutFlow'
import { paymentLabelsFor } from '../cheer/paymentLabels'
import { shownOrderOf } from '../cheer/shownOrder'
import { LinkButton } from '../components/LinkButton'
import { languageOf, useT } from '../i18n'
import styles from './PaymentReturnPage.module.css'

type Settled = Exclude<ReturnPlan, { kind: 'invalid' }>

/**
 * 결제창이 실패 주소로 돌려보냈는데 서버가 읽어 준 주문을 아직(또는 끝내) 모를 때 — 주소가 말한 것만으로 말한다(「그만뒀어요」 · 「결제가 안 됐어요」).
 * 「확인 중」이라 하지 않는다: 창을 닫은 사람에게는 확인할 결제가 없다. 서버가 돈이 움직였다고 하면(`PAID` · `CONFIRMING`) 그때 `PaymentResult` 로 바뀐다.
 */
function LeftResult({
  canceled,
  testMode,
  holdRetry,
  labels,
  onViewHistory,
  onRetry,
}: {
  canceled: boolean
  testMode: boolean | undefined
  /** 서버가 이 주문이 어떻게 됐는지 아직 말하지 않았다 — 돈의 상태를 모르는 동안은 다시 결제하라고 하지 않는다(`PaymentResult` 의 `slow` · `unconfirmed` 와 같다) */
  holdRetry: boolean
  labels: ReturnType<typeof paymentLabelsFor>
  onViewHistory: () => void
  onRetry: () => void
}) {
  return (
    <>
      {testMode && <TestModeNotice labels={labels} />}
      <EmptyState
        headingLevel={2}
        title={canceled ? labels.result.canceled.title : labels.result.failed.title}
        description={canceled ? labels.result.canceled.description : labels.failure.OTHER}
        action={
          <div className={styles.actions}>
            {holdRetry ? (
              <Button variant="primary" onClick={onViewHistory}>
                {labels.result.viewHistory}
              </Button>
            ) : (
              <>
                <Button variant="primary" onClick={onRetry}>
                  {labels.result.retry}
                </Button>
                <Button variant="secondary" onClick={onViewHistory}>
                  {labels.result.viewHistory}
                </Button>
              </>
            )}
          </div>
        }
      />
    </>
  )
}

/**
 * 결제창이 돌려보내는 곳(성공 · 실패 둘 다). 성공 주소면 **같은 주문의 승인을 한 번 보낸다** — 결과를 모르는 오류는 훅이 알아서 다시 보내고(서버는 같은 답을 준다),
 * 새로 고쳐도 서버가 결제사를 다시 부르지 않는다(`CONFIRMING` 은 202, `PAID` 는 200). 실패 주소면 주문을 그만둔 것으로 닫는다.
 * 결과는 서버가 읽어 준 주문으로 그린다 — `CONFIRMING` 동안은 훅이 간격을 늘려 가며 다시 묻는다. 주소의 금액은 사용자가 고칠 수 있어 서버가 대조한다.
 */
function ReturnFlow({ plan }: { plan: Settled }) {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = paymentLabelsFor(t, language)
  const navigate = useNavigate()
  const config = usePaymentConfig(paymentApi)
  const confirm = useConfirmOrder(paymentApi)
  const abandon = useAbandonOrder(paymentApi)
  const orderId = plan.orderId
  // Paddle: 결과가 웹훅으로 서버에 닿는다 - 승인 호출 없이 주문이 `PAID` 가 될 때까지 되묻는다
  const read = useOrder(paymentApi, orderId ?? undefined, plan.kind === 'watch' ? { untilPaid: true } : undefined)

  // 이 주소에 대해 한 번만 — StrictMode 가 효과를 두 번 돌려도 요청은 한 번이다
  const sent = useRef<string | null>(null)
  useEffect(() => {
    const key = JSON.stringify(plan)
    if (sent.current === key) return
    sent.current = key
    if (plan.kind === 'watch') return
    if (plan.kind === 'confirm')
      confirm.mutate({
        orderId: plan.orderId,
        providerPaymentId: plan.providerPaymentId,
        amount: plan.amount,
      })
    else if (plan.orderId !== null) abandon.mutate(plan.orderId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 변경 훅의 mutate 는 매 그림마다 바뀐다; 열쇠(주소)가 같으면 다시 보내지 않는다
  }, [plan])

  const order = shownOrderOf({
    // 웹훅 전의 `PENDING` 은 아직 「확인 중」이다 - 시작도 안 한 주문처럼 보이지 않게 비워 둔다
    read: plan.kind === 'watch' && read.data?.order.status === 'PENDING' ? undefined : read.data?.order,
    reply: confirm.data ?? abandon.data,
    ...(plan.kind === 'left'
      ? { left: plan.canceled ? ('canceled' as const) : ('failed' as const) }
      : {}),
  })

  return (
    <div className={styles.page}>
      <PageHeader title={t('cheer.return.title')} />
      {order === undefined && plan.kind === 'left' ? (
        <LeftResult
          canceled={plan.canceled}
          testMode={config.data?.testMode}
          holdRetry={orderId !== null}
          labels={labels}
          onViewHistory={() => navigate('/cheers')}
          onRetry={() => navigate('/cheer')}
        />
      ) : (
        <PaymentResult
          order={order}
          error={confirm.isError ? confirm.error : undefined}
          testMode={config.data?.testMode}
          locale={language}
          labels={labels}
          onViewHistory={() => navigate('/cheers')}
          onRetry={() => navigate('/cheer')}
        />
      )}
    </div>
  )
}

export function PaymentReturnPage() {
  const { t } = useT()
  const { search } = useLocation()
  const plan = useMemo(() => returnPlanOf(search), [search])
  // 어느 주문인지 모르는 실패 주소는 읽을 수 없는 주소가 아니다(코드가 있다) — 닫을 주문이 없을 뿐이고, 주소가 말한 대로 「그만뒀어요」 · 「결제 안 됨」이라 한다
  if (plan.kind === 'invalid')
    return (
      <div className={styles.page}>
        <PageHeader title={t('cheer.return.title')} />
        <EmptyState
          headingLevel={2}
          title={t('cheer.return.invalidTitle')}
          description={t('cheer.return.invalidBody')}
          action={<LinkButton to="/cheers">{t('cheer.history.title')}</LinkButton>}
        />
      </div>
    )
  return <ReturnFlow plan={plan} />
}
