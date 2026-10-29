import {
  CancelNowDialog,
  CancelScheduledChangeDialog,
  CancelNowResultNotice,
  CancelSubscriptionDialog,
  changeChoices,
  ChangePlanDialog,
  MySubscriptionCard,
  useCancelPreview,
  useCancelScheduledChange,
  useCancelSubscription,
  useCancelSubscriptionNow,
  type CancelNowResult,
  useChangeSubscriptionPlan,
  useMySubscription,
  usePlanChangePreview,
  useSubscriptionPlans,
  isPaymentLedgerError,
  PaymentLedgerErrorCodes,
} from '@skeleton/payment'
import { EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LinkButton } from '../components/LinkButton'
import { LoadError } from '../components/LoadError'
import { languageOf, useT } from '../i18n'
import { subscriptionApi } from '../subscription/api'
import { subscriptionLabelsFor } from '../subscription/labels'
import styles from './SubscriptionPage.module.css'

/**
 * 「내 구독」 — 구독이 없으면 플랜으로 이어 주고, 있으면 `MySubscriptionCard`(플랜 · 상태 · 다음 결제일 · 카드 · 최근 결제 · 「해지 예약」)를 보인다.
 * 「기간 끝에 해지」와 「지금 해지하고 환불」은 확인 창을 거친다(지금 해지는 이 나라의 정책이 열었을 때만 — 환불 예정 금액과 계산 내역을 먼저 보인다). 끝난 구독은 끝난 이유를 말하고 「다시 구독하기」로 이어 준다. 최근 결제 줄 끝의 링크는 결제 한 건(`/payments/:id`)으로 간다.
 */
export function SubscriptionPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = subscriptionLabelsFor(t, language)
  const me = useMySubscription(subscriptionApi)
  const cancel = useCancelSubscription(subscriptionApi)
  const withdraw = useCancelScheduledChange(subscriptionApi)
  const [withdrawing, setWithdrawing] = useState(false)
  const change = useChangeSubscriptionPlan(subscriptionApi)
  const plans = useSubscriptionPlans(subscriptionApi)
  // 지금 해지: 정책이 열었는지(`open`)를 이용 중일 때만 묻고, 확인 창을 열 때마다 새로 읽는다(남은 기간에 따라 금액이 변한다)
  const subscriptionId = me.data?.subscription?.id ?? ''
  const inUse =
    me.data?.subscription?.status === 'ACTIVE' || me.data?.subscription?.status === 'CANCELING'
  const cancelPreview = useCancelPreview(subscriptionApi, subscriptionId, inUse)
  const cancelNow = useCancelSubscriptionNow(subscriptionApi)
  const [endingNow, setEndingNow] = useState(false)
  const [endedNow, setEndedNow] = useState<CancelNowResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  // 플랜 바꾸기 창: 열려 있는 동안 고른 플랜(없으면 닫힘)
  const [changeTo, setChangeTo] = useState<string | null>(null)
  const preview = usePlanChangePreview(subscriptionApi, me.data?.subscription?.id ?? '', changeTo)

  if (me.isPending) return <Spinner label={t('common.loading')} />
  if (me.data === undefined) return <LoadError error={me.error} onRetry={() => void me.refetch()} />

  const { subscription, orders } = me.data
  const header = (
    <PageHeader title={t('subscription.title')} description={t('subscription.subtitle')} />
  )
  if (subscription === null)
    return (
      <div className={styles.page}>
        {header}
        <EmptyState
          headingLevel={2}
          title={t('subscription.emptyTitle')}
          description={t('subscription.emptyBody')}
          action={<LinkButton to="/subscribe">{t('subscription.plansCta')}</LinkButton>}
        />
      </div>
    )

  // 바꿀 수 있는 플랜 - 같은 통화의 다른 등급 · 다른 주기 플랜. 올리기와 주기 늘리기는 바로, 내리기와 주기 줄이기는 다음 결제일부터(예약) - 서버가 같은 표로 판정한다
  // 행사가, 옛 가격으로 산 구독은 그 가격 코드가 더는 목록에 없다 - 구독 응답의 등급(`level`)으로 가르고, 구버전 서버는 플랜 코드로 찾는다
  const currentPlan = plans.data?.find((plan) => plan.code === subscription.planCode)
  const currentLevel = subscription.level ?? currentPlan?.level
  // 결제사 관리 구독(Paddle)은 구매자 통화로 환산돼 구독 금액의 통화가 플랜 표와 다를 수 있다 - 플랜 표의 같은 코드 플랜 통화로 거른다
  const tier =
    currentLevel != null
      ? {
          level: currentLevel,
          period: subscription.period,
          currency: currentPlan?.amount.currency ?? subscription.amount.currency,
        }
      : undefined
  const choices = tier
    ? changeChoices(plans.data ?? [], tier, subscription.planCode)
    : { now: [], next: [] }
  const candidates = [...choices.now, ...choices.next]
  const cancelable = subscription.status === 'ACTIVE' || subscription.status === 'PAST_DUE'
  return (
    <div className={styles.page}>
      {header}
      <MySubscriptionCard
        subscription={subscription}
        orders={orders}
        {...(candidates.length > 0 && subscription.status === 'ACTIVE'
          ? {
              onChangePlan: () => {
                change.reset() // 묵은 오류가 새로 연 창에 보이지 않게
                setChangeTo(candidates[0]!.code)
              },
            }
          : {})}
        {...(subscription.scheduledChange
          ? {
              onCancelScheduledChange: () => {
                withdraw.reset()
                setWithdrawing(true)
              },
            }
          : {})}
        onCancel={() => {
          cancel.reset() // 묵은 오류가 새로 연 창에 보이지 않게
          setConfirming(true)
        }}
        {...(cancelPreview.data?.open && !subscription.providerManaged
          ? {
              onCancelNow: () => {
                cancelNow.reset()
                setEndingNow(true)
                void cancelPreview.refetch()
              },
            }
          : {})}
        renderOrderAction={(order, label, accessibleName, buttonLikeClassName) => (
          <Link
            to={`/payments/${order.id}`}
            className={buttonLikeClassName}
            aria-label={accessibleName}
          >
            {label}
          </Link>
        )}
        locale={language}
        labels={labels}
      />
      {endedNow && subscription.status === 'ENDED' && (
        <CancelNowResultNotice result={endedNow} locale={language} labels={labels} />
      )}
      <div className={styles.actions}>
        <LinkButton to="/refund" variant="secondary">
          {t('subscription.refundPolicy')}
        </LinkButton>
      </div>
      {subscription.status === 'ENDED' && (
        <div className={styles.actions}>
          <LinkButton to="/subscribe">{t('subscription.again')}</LinkButton>
        </div>
      )}
      <ChangePlanDialog
        open={changeTo !== null && subscription.status === 'ACTIVE'}
        onClose={() => setChangeTo(null)}
        onConfirm={(input) =>
          change.mutate(
            { id: subscription.id, ...input },
            {
              onSuccess: () => setChangeTo(null),
              // 그 사이 금액이 올랐다(남은 몫이 줄었다) - 새 금액을 다시 읽어 창이 새 값을 보이게 한다. 사람이 보고 다시 누른다
              onError: (error) => {
                if (isPaymentLedgerError(error, PaymentLedgerErrorCodes.PLAN_CHANGE_CHARGE_CHANGED))
                  void preview.refetch()
              },
            },
          )
        }
        plans={candidates}
        {...(tier && !subscription.providerManaged ? { current: tier } : {})}
        scheduledChange={subscription.scheduledChange}
        planCode={changeTo ?? ''}
        onPlanChange={(code) => {
          change.reset()
          setChangeTo(code)
        }}
        preview={preview.data}
        previewLoading={preview.isFetching}
        previewError={preview.error}
        busy={change.isPending}
        error={change.error}
        locale={language}
        labels={labels}
      />
      {subscription.scheduledChange && (
        <CancelScheduledChangeDialog
          open={withdrawing}
          onClose={() => setWithdrawing(false)}
          onConfirm={() =>
            withdraw.mutate(subscription.id, { onSuccess: () => setWithdrawing(false) })
          }
          scheduledChange={subscription.scheduledChange}
          busy={withdraw.isPending}
          error={withdraw.error}
          locale={language}
          labels={labels}
        />
      )}
      <CancelNowDialog
        open={endingNow && inUse}
        onClose={() => setEndingNow(false)}
        onConfirm={() =>
          cancelNow.mutate(subscription.id, {
            onSuccess: (result) => {
              setEndingNow(false)
              setEndedNow(result)
            },
          })
        }
        preview={cancelPreview.data}
        previewLoading={cancelPreview.isFetching}
        previewError={cancelPreview.error}
        busy={cancelNow.isPending}
        error={cancelNow.error}
        locale={language}
        labels={labels}
      />
      <CancelSubscriptionDialog
        open={confirming && cancelable}
        onClose={() => setConfirming(false)}
        onConfirm={() => cancel.mutate(subscription.id, { onSuccess: () => setConfirming(false) })}
        subscription={subscription}
        busy={cancel.isPending}
        error={cancel.error}
        locale={language}
        labels={labels}
      />
    </div>
  )
}
