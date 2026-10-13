import {
  openBillingAuth,
  priceEveryText,
  SubscriptionPlanList,
  TestModeNotice,
  useStartSubscription,
  useSubscriptionPlans,
  usePaymentConfig,
  type SubscriptionPlan,
} from '@skeleton/payment'
import { Alert, ErrorReference, Field, PageHeader, Select, Spinner } from '@skeleton/ui'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentApi } from '../cheer/api'
import { LinkButton } from '../components/LinkButton'
import { LoadError } from '../components/LoadError'
import { languageOf, useT, type MessageKey } from '../i18n'
import { subscriptionApi } from '../subscription/api'
import { usePaddleAmounts } from '../payment/paddleAmounts'
import { chooseProvider, FORCED_PROVIDER } from '../payment/provider'
import { countryForLocale, countryName, countryOptions } from '../subscription/country'
import { subscriptionLabelsFor } from '../subscription/labels'
import { planNameOf } from '../subscription/planName'
import {
  startFailureOf,
  startSubscribe,
  subscribeReturnUrls,
  type StartFailure,
} from '../subscription/subscribeFlow'
import styles from './SubscribePage.module.css'

type Notice = {
  kind: 'closed' | 'windowFailed' | StartFailure
  error?: unknown
}

const MESSAGE: Record<Notice['kind'], MessageKey> = {
  closed: 'subscription.subscribe.closed',
  windowFailed: 'subscription.subscribe.windowFailed',
  already: 'subscription.subscribe.already',
  unavailable: 'subscription.subscribe.unavailable',
  rateLimited: 'subscription.subscribe.rateLimited',
  failed: 'subscription.subscribe.startFailed',
}

/**
 * 플랜 카드 목록 — 서버가 준 플랜(코드 · 금액 · 주기)에서 하나를 골라 「구독하기」를 누르면 구독을 만들고 토스 카드 등록 창을 연다.
 * 창은 `/subscriptions/return` 으로 돌려보낸다. 플랜 이름은 코드로 된 이 앱의 번역이 있으면 그것을, 없으면 서버 이름을 쓴다.
 */
export function SubscribePage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = subscriptionLabelsFor(t, language)
  const plans = useSubscriptionPlans(subscriptionApi)
  const config = usePaymentConfig(paymentApi)
  // 시작의 429 는 이 화면이 제자리에서(띠) 말한다 - 전역 토스트로 한 번 더 뜨지 않게 이 호출만 조용히 한다
  const start = useStartSubscription(subscriptionApi, { meta: { quietStatuses: [429] } })
  const navigate = useNavigate()
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  // 결제하는 나라 - 화면 언어로 미리 채우고 바꿀 수 있다. 서버는 이 나라로 해지·환불 정책을 고른다
  const [country, setCountry] = useState(() => countryForLocale(language))
  const [notice, setNotice] = useState<Notice | null>(null)

  // 한국이면 토스(카드 등록), 아니면 Paddle(결제창 한 번 - 갱신은 Paddle 이 한다). 설정으로 모두 한쪽으로 돌릴 수 있다
  const provider = chooseProvider({
    providers: config.data?.providers,
    country,
    forced: FORCED_PROVIDER,
  })

  const amountOf = usePaddleAmounts(provider)

  // 카드 창에서 뒤로 가기로 돌아오면(브라우저가 이 화면을 그대로 되살린다) 「여는 중」에 갇히지 않게
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setBusyPlan(null)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  if (plans.isPending) return <Spinner label={t('common.loading')} />
  if (plans.data === undefined)
    return <LoadError error={plans.error} onRetry={() => void plans.refetch()} />

  async function subscribe(plan: SubscriptionPlan) {
    if (busyPlan !== null) return
    setBusyPlan(plan.code)
    setNotice(null)
    const result = await startSubscribe(
      {
        start: (planCode, buyerCountry, chosen) =>
          start.mutateAsync({
            planCode,
            ...(buyerCountry ? { country: buyerCountry } : {}),
            ...(chosen ? { provider: chosen } : {}),
          }),
        openBillingAuth: (billingAuth, urls) =>
          openBillingAuth(billingAuth, { ...urls, locale: language }),
        urlsFor: (id, chosen) => subscribeReturnUrls(window.location.origin, id, chosen),
      },
      plan.code,
      country,
      provider,
    )
    if (result.kind === 'opened') return // 카드 창이 이 화면을 떠나게 한다 — 돌아오면 `pageshow` 가 풀어 준다
    setBusyPlan(null)
    if (result.kind === 'settled') void navigate('/subscription')
    else if (result.kind === 'canceled') setNotice({ kind: 'closed' })
    else if (result.kind === 'window-failed')
      setNotice({ kind: 'windowFailed', error: result.error })
    else setNotice({ kind: startFailureOf(result.error), error: result.error })
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('subscription.subscribe.title')}
        description={t('subscription.subscribe.subtitle')}
      />
      {config.data?.testMode && <TestModeNotice labels={labels} />}
      {notice && (
        <Alert
          tone={notice.kind === 'closed' ? 'info' : 'danger'}
          toneLabel={notice.kind === 'closed' ? labels.noticeLabel : labels.errorLabel}
        >
          <div className={styles.notice}>
            <span>{t(MESSAGE[notice.kind])}</span>
            {notice.kind === 'already' && (
              <div>
                <LinkButton to="/subscription" variant="secondary">
                  {t('subscription.subscribe.alreadyLink')}
                </LinkButton>
              </div>
            )}
            {notice.error !== undefined && notice.kind !== 'already' && (
              <div className={styles.reference}>
                <ErrorReference
                  error={notice.error}
                  label={labels.reference.label}
                  copyLabel={labels.reference.copy}
                  copiedLabel={labels.reference.copied}
                />
              </div>
            )}
          </div>
        </Alert>
      )}
      <div className={styles.country}>
        <Field
          label={t('subscription.subscribe.country')}
          hint={t('subscription.subscribe.countryHint')}
        >
          {(control) => (
            <Select
              {...control}
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            >
              {countryOptions(countryForLocale(language)).map((code) => (
                <option key={code} value={code}>
                  {countryName(code, language)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div>
          <LinkButton to="/refund" variant="secondary">
            {t('subscription.refundPolicy')}
          </LinkButton>
        </div>
      </div>
      <SubscriptionPlanList
        plans={plans.data.map((plan) => ({ ...plan, name: planNameOf(t, plan) }))}
        onSubscribe={(plan) => void subscribe(plan)}
        busyPlanCode={busyPlan}
        locale={language}
        labels={labels}
        priceOf={(plan) => {
          const slot = amountOf(plan.code)
          if (slot.kind === 'table') return undefined
          if (slot.kind === 'paddle')
            // 주기도 Paddle 가격의 것이다(우리 플랜 주기가 아니다) - 1회 가격이면 금액만
            return slot.period ? priceEveryText(slot.text, slot.period, labels) : slot.text
          return t(
            slot.kind === 'loading' ? 'payment.paddle.priceLoading' : 'payment.paddle.priceFailed',
          )
        }}
      />
    </div>
  )
}
