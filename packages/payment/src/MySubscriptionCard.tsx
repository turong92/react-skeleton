import { formatInstant } from '@skeleton/time'
import { Alert, Button, Card } from '@skeleton/ui'
import { cardDisplay, lookup, priceEveryDisplay } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { Order } from './ledgerTypes'
import { OrderList, type OrderListProps } from './OrderList'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'
import type { Subscription } from './subscriptionTypes'
import { TestModeNotice } from './TestModeNotice'
import styles from './MySubscriptionCard.module.css'

export type MySubscriptionCardProps = {
  subscription: Subscription
  /** 최근 결제(`GET /subscriptions/me` 의 `orders`) */
  orders: readonly Order[]
  /** 주면 이용 중(`ACTIVE` · `PAST_DUE`)일 때 채운 「해지 예약」 단추가 생긴다. 확인 창을 여는 것은 부모(`CancelSubscriptionDialog`) */
  onCancel?: () => void
  /** 최근 결제 줄 끝의 「자세히」 링크(라우터 `<Link>`) — `OrderList` 의 `renderAction` 과 같다 */
  renderOrderAction?: OrderListProps['renderAction']
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

/**
 * 「내 구독」 — 플랜 · 상태 알약 · 금액 · 다음 결제일(해지 예약이면 「○○에 끝나요」) · 카드 · 최근 결제 · 「해지 예약」.
 * 상태는 알약 글자와 안내 띠로 말한다: `PENDING` 은 첫 결제를 확인하는 중, `PAST_DUE` 는 다시 시도하는 중(이용 불가), `ENDED` 는 끝난 이유.
 */
export function MySubscriptionCard({
  subscription,
  orders,
  onCancel,
  renderOrderAction,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: MySubscriptionCardProps) {
  const labels = resolvePaymentLabels(input)
  const mine = labels.subscription.mine
  const { status } = subscription
  const card = cardDisplay({ method: 'CARD', card: subscription.card }, labels)
  const dated = status === 'ACTIVE' || status === 'PAST_DUE' || status === 'CANCELING'
  return (
    <Card
      title={subscription.planName}
      actions={<SubscriptionStatusBadge status={status} labels={input} />}
    >
      <div className={styles.body}>
        {subscription.testMode && <TestModeNotice labels={input} />}
        {status === 'PENDING' && (
          <Alert tone="info" toneLabel={labels.noticeLabel}>
            {mine.pending}
          </Alert>
        )}
        {status === 'PAST_DUE' && (
          <Alert tone="warning" toneLabel={labels.noticeLabel}>
            {mine.pastDue}
          </Alert>
        )}
        {status === 'ENDED' && (
          <Alert tone="info" toneLabel={labels.noticeLabel}>
            {(subscription.endReason && lookup(mine.ended, subscription.endReason)) ||
              mine.endedUnknown}
          </Alert>
        )}
        <dl className={styles.facts}>
          <Fact label={mine.amount}>
            {priceEveryDisplay(subscription.amount, subscription.period, labels, locale)}
          </Fact>
          {dated && status !== 'CANCELING' && (
            <Fact label={mine.nextPayment}>{formatTime(subscription.currentPeriodEnd)}</Fact>
          )}
          {status === 'CANCELING' && (
            <Fact label={mine.access}>
              {mine.endsOn(formatTime(subscription.currentPeriodEnd))}
            </Fact>
          )}
          {card && status !== 'ENDED' && <Fact label={mine.card}>{card}</Fact>}
        </dl>
        {orders.length > 0 && (
          <section aria-label={mine.recentPayments} className={styles.recent}>
            <h3 className={styles.heading}>{mine.recentPayments}</h3>
            <OrderList
              orders={orders}
              locale={locale}
              formatTime={formatTime}
              labels={input}
              {...(renderOrderAction ? { renderAction: renderOrderAction } : {})}
            />
          </section>
        )}
        {onCancel && (status === 'ACTIVE' || status === 'PAST_DUE') && (
          <div className={styles.action}>
            <Button variant="primary" onClick={onCancel}>
              {mine.cancel}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
