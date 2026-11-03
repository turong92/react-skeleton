import { openCheckout, useAbandonOrder, useCreateOrder } from '@skeleton/payment'
import { Alert, Button } from '@skeleton/ui'
import { useState } from 'react'
import { paymentApi } from '../cheer/api'
import {
  checkoutReturnUrls,
  nowMs,
  reusableOrderOf,
  startCheer,
  unopenedAfter,
  type UnopenedOrder,
} from '../cheer/checkoutFlow'
import { languageOf, useT } from '../i18n'

/**
 * 결제를 시작한 보류의 결제 자리 - 주문(`itemType: "booking"`, `itemRef: 보류 id`)을 만들어 결제창을 연다.
 * 갈래 처리는 응원하기와 같은 `startCheer`: 창을 닫으면 주문을 돌려놓고, 창이 안 열렸으면 같은 주문의 창만 다시 연다(눌러도 주문이 쌓이지 않는다),
 * 이미 결제된 주문이면 `onPaid` 로 보류를 다시 읽어 확정된 모습을 보인다.
 * 금액은 서버가 결제 시작 때 박은 값이다(브라우저가 정하지 않는다). 돌아오는 주소는 응원하기와 같은 `/payments/return`.
 */
export function BookingPayment({ holdId, onPaid }: { holdId: string; onPaid: () => void }) {
  const { t, locale } = useT()
  const createOrder = useCreateOrder(paymentApi)
  const abandon = useAbandonOrder(paymentApi)
  const [failed, setFailed] = useState(false)
  const [unopened, setUnopened] = useState<UnopenedOrder | null>(null)
  const [busy, setBusy] = useState(false)

  async function open() {
    setBusy(true)
    setFailed(false)
    const result = await startCheer(
      {
        createOrder: createOrder.mutateAsync,
        openCheckout: (checkout, options) =>
          openCheckout(checkout, { ...options, locale: languageOf(locale) }),
        abandonOrder: abandon.mutateAsync,
        returnOrigin: window.location.origin,
        itemType: 'booking',
        urlsFor: (orderId, provider) =>
          checkoutReturnUrls(window.location.origin, orderId, provider),
      },
      holdId,
      reusableOrderOf(unopened, holdId, nowMs()),
    )
    setUnopened(unopenedAfter(result, holdId, nowMs(), unopened))
    if (result.kind === 'opened') return // 결제창이 이 화면을 떠나게 한다
    setBusy(false)
    if (result.kind === 'settled') onPaid()
    else if (result.kind !== 'canceled') setFailed(true)
  }

  return (
    <>
      {failed && <Alert tone="danger">{t('booking.pay.failed')}</Alert>}
      <Button onClick={() => void open()} loading={busy}>
        {t('booking.pay.open')}
      </Button>
    </>
  )
}
