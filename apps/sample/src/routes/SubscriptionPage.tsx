import {
  CancelSubscriptionDialog,
  ChangePlanDialog,
  MySubscriptionCard,
  useCancelSubscription,
  useChangeSubscriptionPlan,
  useMySubscription,
  usePlanChangePreview,
  useSubscriptionPlans,
} from '@skeleton/payment'
import { EmptyState, PageHeader, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LinkButton } from '../components/LinkButton'
import { LoadError } from '../components/LoadError'
import { languageOf, useT } from '../i18n'
import { subscriptionApi } from '../subscription/api'
import { subscriptionLabelsFor } from '../subscription/labels'
import { planNameOf } from '../subscription/planName'
import styles from './SubscriptionPage.module.css'

/**
 * 「내 구독」 — 구독이 없으면 플랜으로 이어 주고, 있으면 `MySubscriptionCard`(플랜 · 상태 · 다음 결제일 · 카드 · 최근 결제 · 「해지 예약」)를 보인다.
 * 「해지 예약」은 확인 창을 거친다. 끝난 구독은 끝난 이유를 말하고 「다시 구독하기」로 이어 준다. 최근 결제 줄 끝의 링크는 결제 한 건(`/payments/:id`)으로 간다.
 */
export function SubscriptionPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = subscriptionLabelsFor(t, language)
  const me = useMySubscription(subscriptionApi)
  const cancel = useCancelSubscription(subscriptionApi)
  const change = useChangeSubscriptionPlan(subscriptionApi)
  const plans = useSubscriptionPlans(subscriptionApi)
  const [confirming, setConfirming] = useState(false)
  // 플랜 올리기 창: 열려 있는 동안 고른 플랜(없으면 닫힘)
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

  // 지금보다 윗등급이고 주기 · 통화가 같은 플랜만 - 서버가 같은 규칙으로 거절한다
  const current = plans.data?.find((plan) => plan.code === subscription.planCode)
  const upgrades = (plans.data ?? [])
    .filter(
      (plan) =>
        current !== undefined &&
        plan.level > current.level &&
        plan.period === subscription.period &&
        plan.amount.currency === subscription.amount.currency,
    )
    .map((plan) => ({ ...plan, name: planNameOf(t, plan) }))
  const cancelable = subscription.status === 'ACTIVE' || subscription.status === 'PAST_DUE'
  return (
    <div className={styles.page}>
      {header}
      <MySubscriptionCard
        subscription={{
          ...subscription,
          planName: planNameOf(t, { code: subscription.planCode, name: subscription.planName }),
        }}
        orders={orders}
        {...(upgrades.length > 0 && subscription.status === 'ACTIVE'
          ? {
              onChangePlan: () => {
                change.reset() // 묵은 오류가 새로 연 창에 보이지 않게
                setChangeTo(upgrades[0]!.code)
              },
            }
          : {})}
        onCancel={() => {
          cancel.reset() // 묵은 오류가 새로 연 창에 보이지 않게
          setConfirming(true)
        }}
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
      {subscription.status === 'ENDED' && (
        <div className={styles.actions}>
          <LinkButton to="/subscribe">{t('subscription.again')}</LinkButton>
        </div>
      )}
      <ChangePlanDialog
        open={changeTo !== null && subscription.status === 'ACTIVE'}
        onClose={() => setChangeTo(null)}
        onConfirm={(input) =>
          change.mutate({ id: subscription.id, ...input }, { onSuccess: () => setChangeTo(null) })
        }
        plans={upgrades}
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
