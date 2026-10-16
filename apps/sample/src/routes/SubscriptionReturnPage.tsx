import {
  PaymentResult,
  useActivateSubscription,
  useMySubscription,
  usePaymentConfig,
} from '@skeleton/payment'
import { Button, EmptyState, PageHeader } from '@skeleton/ui'
import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { paymentApi } from '../cheer/api'
import { LinkButton } from '../components/LinkButton'
import { languageOf, useT } from '../i18n'
import { subscriptionApi } from '../subscription/api'
import { subscriptionLabelsFor } from '../subscription/labels'
import { planNameOf } from '../subscription/planName'
import { claimActivation, returnPlanOf, type ReturnPlan } from '../subscription/subscribeFlow'
import { shownSubscriptionOf, subscriptionAsOrder } from '../subscription/subscriptionAsOrder'
import styles from './SubscriptionReturnPage.module.css'

/**
 * 카드 등록 창이 돌려보내는 곳(성공 · 실패 둘 다). 성공 주소면 **같은 `authKey` 로 첫 결제를 한 번만 보낸다** - 효과가 두 번 돌아도, 뒤로 · 앞으로 가서 다시 떠도 같은 값은 다시 보내지 않는다
 * (결과를 모르는 오류는 훅이 알아서 다시 보내고, 서버는 재전송을 안전하게 받는다). 결과는 서버가 읽어 준 구독으로 그린다 - 확인 중(`PENDING`)이면 훅이 간격을 늘려 가며 다시 묻는다.
 */
function ActivateFlow({ plan }: { plan: Extract<ReturnPlan, { kind: 'activate' }> }) {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = subscriptionLabelsFor(t, language)
  const navigate = useNavigate()
  const config = usePaymentConfig(paymentApi)
  const activate = useActivateSubscription(subscriptionApi)
  const me = useMySubscription(subscriptionApi)

  useEffect(() => {
    if (claimActivation(plan.id, plan.authKey))
      activate.mutate({ id: plan.id, authKey: plan.authKey })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 변경 훅의 mutate 는 매 그림마다 바뀐다; 같은 (구독, authKey) 는 `claimActivation` 이 한 번만 통과시킨다
  }, [plan])

  const shown = shownSubscriptionOf(plan.id, {
    read: me.data?.subscription,
    reply: activate.data,
  })
  const order = shown
    ? subscriptionAsOrder(shown, planNameOf(t, { code: shown.planCode, name: shown.planName }))
    : undefined

  return (
    <PaymentResult
      order={order}
      error={activate.isError ? activate.error : undefined}
      testMode={config.data?.testMode}
      locale={language}
      labels={labels}
      onViewHistory={() => void navigate('/subscription')}
      onRetry={() => void navigate('/subscribe')}
    />
  )
}

/**
 * Paddle 결제창이 돌려보내는 곳. 카드 등록 · 첫 승인 호출이 없다 - 첫 결제는 웹훅으로 서버에 닿아 구독이 `ACTIVE` 가 되므로 「내 구독」을 되묻기만 한다
 * (시작만 한 구독은 `me` 에 보이지 않다가 웹훅 뒤에 나타난다).
 */
function WatchFlow({ id }: { id: string }) {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = subscriptionLabelsFor(t, language)
  const navigate = useNavigate()
  const config = usePaymentConfig(paymentApi)
  const me = useMySubscription(subscriptionApi, { subscriptionId: id })
  const shown = shownSubscriptionOf(id, { read: me.data?.subscription })
  const order = shown
    ? subscriptionAsOrder(shown, planNameOf(t, { code: shown.planCode, name: shown.planName }))
    : undefined
  return (
    <PaymentResult
      order={order}
      testMode={config.data?.testMode}
      locale={language}
      labels={labels}
      onViewHistory={() => void navigate('/subscription')}
      onRetry={() => void navigate('/subscribe')}
    />
  )
}

export function SubscriptionReturnPage() {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const { search } = useLocation()
  const plan = useMemo(() => returnPlanOf(search), [search])
  const header = <PageHeader title={t('subscription.return.title')} />
  const labels = subscriptionLabelsFor(t, languageOf(locale))

  if (plan.kind === 'invalid')
    return (
      <div className={styles.page}>
        {header}
        <EmptyState
          headingLevel={2}
          title={t('subscription.return.invalidTitle')}
          description={t('subscription.return.invalidBody')}
          action={<LinkButton to="/subscription">{t('subscription.title')}</LinkButton>}
        />
      </div>
    )
  if (plan.kind === 'left')
    return (
      <div className={styles.page}>
        {header}
        <EmptyState
          headingLevel={2}
          title={t(
            plan.canceled ? 'subscription.return.closedTitle' : 'subscription.return.leftTitle',
          )}
          description={t(
            plan.canceled ? 'subscription.return.closedBody' : 'subscription.return.leftBody',
          )}
          action={
            <div className={styles.actions}>
              <Button variant="primary" onClick={() => void navigate('/subscribe')}>
                {labels.result.retry}
              </Button>
              <Button variant="secondary" onClick={() => void navigate('/subscription')}>
                {t('subscription.title')}
              </Button>
            </div>
          }
        />
      </div>
    )
  return (
    <div className={styles.page}>
      {header}
      {plan.kind === 'watch' ? <WatchFlow id={plan.id} /> : <ActivateFlow plan={plan} />}
    </div>
  )
}
