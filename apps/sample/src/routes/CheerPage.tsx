import {
  easyPaysFor,
  EasyPayButtons,
  formatMoney,
  openCheckout,
  TestModeNotice,
  useAbandonOrder,
  useCreateOrder,
  usePaymentConfig,
} from '@skeleton/payment'
import {
  Alert,
  Button,
  Card,
  ChoiceGroup,
  EmptyState,
  ErrorReference,
  PageHeader,
  Spinner,
} from '@skeleton/ui'
import { formatInstant } from '@skeleton/time'
import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentApi } from '../cheer/api'
import { usePaddleAmounts } from '../payment/paddleAmounts'
import { CountryPolicyNotice } from '../payment/CountryPolicyNotice'
import { useServerProvider } from '../payment/useProvider'
import {
  checkoutReturnUrls,
  nowMs,
  orderFailureOf,
  reusableOrderOf,
  startCheer,
  unopenedAfter,
  type UnopenedOrder,
} from '../cheer/checkoutFlow'
import {
  holdReasonOf,
  noticeAfterOpening,
  noticeOfOrderFailure,
  openingIn,
} from '../cheer/cheerHold'
import { paymentLabelsFor } from '../cheer/paymentLabels'
import { useCheerOptions } from '../cheer/queries'
import type { CheerOption } from '../cheer/types'
import { LoadError } from '../components/LoadError'
import { languageOf, useT } from '../i18n'
import styles from './CheerPage.module.css'

type Notice =
  | {
      kind: 'closed' | 'windowFailed' | 'orderFailed' | 'notOffered' | 'unavailable'
      error?: unknown
    }
  /** `until`(ms)은 막힘이 풀리는 시각 - 문장에는 이 시각을 쓴다. `null` 이면 서버가 기다림을 알려 주지 않았다 - 「잠시 뒤에」 */
  | { kind: 'rateLimited'; until: number | null; error: unknown }

/** 처음 고를 칸 — 가운데 금액(없으면 첫 칸) */
const defaultOf = (options: readonly CheerOption[]) =>
  (options[Math.floor((options.length - 1) / 2)] ?? options[0])?.itemRef ?? null

/**
 * Patterns/Form page 를 줄인 화면 — 서버가 준 금액 목록에서 하나를 고르고(브라우저가 금액을 정하지 않는다) 채운 단추 「응원하기」 하나로
 * 주문을 만들어 결제창을 연다. 결제창은 `/payments/return` 으로 돌려보낸다. 못 누르는 단추는 흐리게 두고 이유를 옆에 적는다.
 */
export function CheerPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = paymentLabelsFor(t, language)
  const options = useCheerOptions()
  const config = usePaymentConfig(paymentApi)
  // 결제사는 서버가 접속 나라로 정한다(한국이면 토스, 아니면 Paddle). 같은 나라에 결제사가 둘 이상 켜졌을 때만(`config.choices` — 토스 + 카카오페이) 사람이 「결제 방법」을 고른다
  const serverProvider = useServerProvider()
  const choices = config.data?.choices ?? []
  const [pickedProvider, setPickedProvider] = useState<string | null>(null)
  const chosenProvider =
    choices.length > 1
      ? pickedProvider !== null && choices.includes(pickedProvider)
        ? pickedProvider
        : serverProvider !== undefined && choices.includes(serverProvider)
          ? serverProvider
          : choices[0]
      : undefined
  const provider = chosenProvider ?? serverProvider
  const amountOf = usePaddleAmounts(provider)
  // 주문 만들기의 429 는 이 화면이 제자리에서(띠 · 단추 옆) 말한다 - 전역 토스트로 한 번 더 뜨지 않게 이 호출만 조용히 한다
  const createOrder = useCreateOrder(paymentApi, { meta: { quietStatuses: [429] } })
  const abandon = useAbandonOrder(paymentApi)
  const [chosen, setChosen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 눌린 간편결제 코드 - 창을 여는 중 스피너는 눌린 그 단추에만 뜬다(카드 단추는 `null`)
  const [pickedEasyPay, setPickedEasyPay] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  // 결제창을 못 열었을 때 만든 주문 — 같은 금액으로 다시 누르면 새 주문 대신 이 주문의 창만 다시 연다(금액을 바꾸거나 시간이 지나면 버린다)
  const [unopened, setUnopened] = useState<UnopenedOrder | null>(null)
  // 서버에 결제창 키가 없다는 답을 받았다 - 다시 눌러도 같고 누를 때마다 주문 + 돌려놓기가 나가 한도(429)를 쓴다. 화면을 새로 열 때까지 막는다
  const [keyMissing, setKeyMissing] = useState(false)
  const navigate = useNavigate()
  const reasonId = useId()
  const legendId = useId()
  const providerLegendId = useId()

  // 요청이 많아 막힌 때는 풀리는 시각까지 단추를 막고 이유를 적는다(눌러도 같은 429 이고, 같은 키 재전송도 한도를 쓴다). 그 시각에 막힘과 **안내를 함께** 비운다
  useEffect(() => {
    const waitMs = openingIn(notice, Date.now())
    if (waitMs === null) return
    const timer = setTimeout(() => setNotice(noticeAfterOpening), waitMs)
    return () => clearTimeout(timer)
  }, [notice])

  // 결제창에서 뒤로 가기로 돌아오면(브라우저가 이 화면을 그대로 되살린다) 「여는 중」에 갇히지 않게
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(false)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  if (options.isPending) return <Spinner label={t('common.loading')} />
  // 금액 목록이 이미 있는데 다시 읽기만 실패했다면 폼을 바꾸지 않는다(결제를 시작하는 중일 수 있다)
  if (options.data === undefined)
    return <LoadError error={options.error} onRetry={() => void options.refetch()} />

  const offered = options.data
  const selected =
    chosen !== null && offered.some((option) => option.itemRef === chosen)
      ? chosen
      : defaultOf(offered)
  // Paddle 로 결제하면 금액은 Paddle 가격이다 - 못 받았으면 원화 표로 되돌아가지 않고 숨긴다
  const amountLabel = (option: CheerOption, index: number) => {
    const slot = amountOf(option.itemRef)
    if (slot.kind === 'paddle') return slot.text
    if (slot.kind === 'loading') return t('payment.paddle.priceLoading')
    if (slot.kind === 'failed') return t('cheer.optionN', { n: index + 1 })
    return formatMoney(option.amount, { locale: language, currencySuffix: labels.currencySuffix })
  }
  const priceFailed = offered.some((option) => amountOf(option.itemRef).kind === 'failed')
  const providerLabel = (id: string) =>
    id === 'toss' || id === 'kakaopay' ? t(`cheer.provider.${id}`) : id
  const timeOf = (until: number) =>
    formatInstant(new Date(until).toISOString(), { locale: language })
  const hold = holdReasonOf({ configAvailable: config.data?.available, keyMissing, notice })
  const reason =
    hold === 'unavailable'
      ? t('cheer.unavailable')
      : hold === 'rateLimited' && notice?.kind === 'rateLimited' && notice.until !== null
        ? t('cheer.rateLimitedWait', { time: timeOf(notice.until) })
        : null
  const held = reason !== null
  // 카드 단추(「응원하기」) 옆의 간편결제 - 서버 설정이 정한다(비면 지금 화면 그대로)
  const easyPays = easyPaysFor(config.data, provider)

  async function submit(easyPay?: string) {
    if (selected === null || busy || held) return
    setBusy(true)
    setPickedEasyPay(easyPay ?? null)
    setNotice(null)
    const result = await startCheer(
      {
        createOrder: createOrder.mutateAsync,
        openCheckout: (checkout, options) =>
          openCheckout(checkout, { ...options, locale: language }),
        abandonOrder: abandon.mutateAsync,
        urlsFor: (orderId, chosen) => checkoutReturnUrls(window.location.origin, orderId, chosen),
      },
      selected,
      reusableOrderOf(unopened, selected, nowMs(), chosenProvider),
      easyPay,
      chosenProvider,
    )
    setUnopened(unopenedAfter(result, selected, nowMs(), unopened, chosenProvider))
    if (result.kind === 'opened') return // 결제창이 이 화면을 떠나게 한다 — 돌아오면 `pageshow` 가 풀어 준다
    setBusy(false)
    if (result.kind === 'settled') {
      // 같은 키의 주문이 이미 결제됐거나 승인 중이다 - 실패가 아니라 그 주문의 화면으로
      void navigate(`/payments/${encodeURIComponent(result.orderId)}`)
      return
    }
    if (result.kind === 'canceled') setNotice({ kind: 'closed' })
    else if (result.kind === 'unavailable')
      setKeyMissing(true) // 이유는 단추 옆에 같은 글자로 선다
    else if (result.kind === 'window-failed')
      setNotice({ kind: 'windowFailed', error: result.error })
    else {
      // 503 도 안내로 말한다(띠 + 문의 번호) - 막지 않으니 다시 누를 수 있다
      setNotice(noticeOfOrderFailure(orderFailureOf(result.error, nowMs()), result.error))
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader title={t('cheer.title')} description={t('cheer.subtitle')} />
      {offered.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title={t('cheer.noOptionsTitle')}
          description={t('cheer.noOptionsBody')}
        />
      ) : (
        <Card>
          <div className={styles.form}>
            <div className={styles.group}>
              <span id={legendId} className={styles.legend}>
                {t('cheer.amountLegend')}
              </span>
              <ChoiceGroup
                aria-labelledby={legendId}
                options={offered.map((option, index) => ({
                  value: option.itemRef,
                  label: amountLabel(option, index),
                }))}
                value={selected}
                onChange={setChosen}
                disabled={busy}
              />
              {priceFailed && <p className={styles.reason}>{t('payment.paddle.priceFailed')}</p>}
            </div>
            {chosenProvider !== undefined && (
              <div className={styles.group}>
                <span id={providerLegendId} className={styles.legend}>
                  {t('cheer.providerLegend')}
                </span>
                <ChoiceGroup
                  aria-labelledby={providerLegendId}
                  options={choices.map((id) => ({ value: id, label: providerLabel(id) }))}
                  value={chosenProvider}
                  onChange={setPickedProvider}
                  disabled={busy}
                />
              </div>
            )}
            <CountryPolicyNotice />
            {config.data?.testMode && <TestModeNotice labels={labels} />}
            {notice && (
              <Alert
                tone={notice.kind === 'closed' ? 'info' : 'danger'}
                toneLabel={notice.kind === 'closed' ? labels.noticeLabel : labels.errorLabel}
              >
                {notice.kind === 'rateLimited'
                  ? notice.until === null
                    ? t('cheer.rateLimitedSoon')
                    : t('cheer.rateLimited', { time: timeOf(notice.until) })
                  : t(`cheer.${notice.kind}`)}
                {notice.error !== undefined && (
                  <div className={styles.reference}>
                    <ErrorReference
                      error={notice.error}
                      label={labels.reference.label}
                      copyLabel={labels.reference.copy}
                      copiedLabel={labels.reference.copied}
                    />
                  </div>
                )}
              </Alert>
            )}
            <div className={styles.action}>
              <Button
                size="lg"
                loading={busy && pickedEasyPay === null}
                loadingLabel={t('cheer.opening')}
                disabled={busy}
                aria-disabled={held ? true : undefined}
                aria-describedby={held ? reasonId : undefined}
                onClick={held ? undefined : () => void submit()}
              >
                {t('cheer.submit')}
              </Button>
              <EasyPayButtons
                codes={easyPays}
                labels={labels}
                disabled={busy}
                ariaDisabled={held}
                describedBy={held ? reasonId : undefined}
                loadingCode={busy ? pickedEasyPay : null}
                loadingLabel={t('cheer.opening')}
                onPick={(code) => void submit(code)}
              />
              {reason !== null && (
                <span id={reasonId} className={styles.reason}>
                  {reason}
                </span>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
