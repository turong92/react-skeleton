import {
  discountErrorMessage,
  openBillingAuth,
  priceEveryText,
  SubscriptionPlanList,
  TestModeNotice,
  useStartSubscription,
  useSubscriptionPlans,
  usePaymentConfig,
  type SubscriptionPlan,
} from '@skeleton/payment'
import { CouponPicker, useCoupons } from '@skeleton/rewards'
import { Alert, ChoiceGroup, ErrorReference, PageHeader, Spinner } from '@skeleton/ui'
import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentApi } from '../cheer/api'
import { rewardsApi } from '../rewards/api'
import { rewardsLabelsFor } from '../rewards/labels'
import { LinkButton } from '../components/LinkButton'
import { LoadError } from '../components/LoadError'
import { i18n, languageOf, useT, type MessageKey } from '../i18n'
import { subscriptionApi } from '../subscription/api'
import { usePaddleAmounts } from '../payment/paddleAmounts'
import { CountryPolicyNotice } from '../payment/CountryPolicyNotice'
import { useServerProvider } from '../payment/useProvider'
import { subscriptionLabelsFor } from '../subscription/labels'
import { planNameOf } from '../subscription/planName'
import {
  chosenSubscriptionProvider,
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
  const [notice, setNotice] = useState<Notice | null>(null)
  const providerLegendId = useId()
  const couponLegendId = useId()
  // 쿠폰 - 첫 결제부터 적용된다. 구독은 견적 호출이 없어 할인 뒤 금액은 미리 보이지 않는다(서버가 시작 때 계산한다)
  const coupons = useCoupons(rewardsApi, 'AVAILABLE')
  const [pickedCoupon, setPickedCoupon] = useState<string | null>(null)
  const [couponProblem, setCouponProblem] = useState<string | null>(null)
  const couponRef =
    pickedCoupon !== null && coupons.data?.some((coupon) => coupon.id === pickedCoupon)
      ? pickedCoupon
      : null

  // 결제사는 서버가 접속 나라로 정한다(한국이면 토스 카드 등록, 아니면 Paddle 결제창 한 번 - 갱신은 Paddle 이 한다). 화면은 고르지 않는다
  const serverProvider = useServerProvider()
  // 같은 나라에서 정기 결제를 받는 결제사가 둘 이상 켜졌을 때만(`config.subscriptionChoices` - 토스 + 카카오페이 …) 사람이 「결제 방법」을 고른다
  const choices = config.data?.subscriptionChoices ?? []
  const [pickedProvider, setPickedProvider] = useState<string | null>(null)
  const chosenProvider = chosenSubscriptionProvider(choices, pickedProvider, serverProvider)
  const provider = chosenProvider ?? serverProvider

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
    setCouponProblem(null)
    const result = await startSubscribe(
      {
        start: (planCode) =>
          start.mutateAsync({
            planCode,
            ...(chosenProvider !== undefined ? { provider: chosenProvider } : {}),
            // 카카오페이 · 네이버페이는 서버가 정한 주소로 돌아온다 - 이 화면의 origin 으로 돌아오게 한다(허용 목록 안일 때만 서버가 따른다)
            returnOrigin: window.location.origin,
            ...(couponRef !== null
              ? { discounts: [{ type: 'coupon' as const, ref: couponRef }] }
              : {}),
          }),
        openBillingAuth: (billingAuth, urls) =>
          openBillingAuth(billingAuth, { ...urls, locale: language }),
        urlsFor: (id, chosen) => subscribeReturnUrls(window.location.origin, id, chosen),
      },
      plan.code,
    )
    if (result.kind === 'opened') return // 카드 창이 이 화면을 떠나게 한다 — 돌아오면 `pageshow` 가 풀어 준다
    setBusyPlan(null)
    if (result.kind === 'settled') void navigate('/subscription')
    else if (result.kind === 'canceled') setNotice({ kind: 'closed' })
    else if (result.kind === 'window-failed')
      setNotice({ kind: 'windowFailed', error: result.error })
    else if (discountErrorMessage(result.error, labels) !== null) {
      // 쿠폰이 안 맞거나 이미 쓰는 중이다 - 이유를 말하고 쿠폰 없이 다시 고르게 한다
      setCouponProblem(discountErrorMessage(result.error, labels))
      setPickedCoupon(null)
    } else setNotice({ kind: startFailureOf(result.error), error: result.error })
  }

  // 이름표는 사전이 가진 결제사 id 만 - 모르는 id(설정으로 바꾼 `provider-id`)는 id 그대로
  const providerLabel = (id: string) => {
    const key = `cheer.provider.${id}`
    return i18n.has(key) ? t(key) : id
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
      {chosenProvider !== undefined && (
        <div className={styles.group}>
          <span id={providerLegendId} className={styles.legend}>
            {t('subscription.subscribe.providerLegend')}
          </span>
          <ChoiceGroup
            aria-labelledby={providerLegendId}
            options={choices.map((id) => ({ value: id, label: providerLabel(id) }))}
            value={chosenProvider}
            onChange={setPickedProvider}
            disabled={busyPlan !== null}
          />
        </div>
      )}
      {coupons.data !== undefined && coupons.data.length > 0 && (
        <div className={styles.group}>
          <span id={couponLegendId} className={styles.legend}>
            {t('subscription.subscribe.couponLegend')}
          </span>
          <p className={styles.legend}>{t('subscription.subscribe.couponHint')}</p>
          <CouponPicker
            coupons={coupons.data}
            selectedId={couponRef}
            onSelect={(id) => {
              setCouponProblem(null)
              setPickedCoupon(id)
            }}
            labels={rewardsLabelsFor(language)}
            locale={language}
          />
        </div>
      )}
      {couponProblem !== null && (
        <Alert tone="warning" toneLabel={labels.noticeLabel}>
          {couponProblem} {t('cheer.couponDropped')}
        </Alert>
      )}
      <CountryPolicyNotice />
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
