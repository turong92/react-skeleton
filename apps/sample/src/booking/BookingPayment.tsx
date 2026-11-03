import { checkoutToOpen, openCheckout, useCreateOrder, type Checkout } from '@skeleton/payment'
import { Alert, Button } from '@skeleton/ui'
import { useState } from 'react'
import { paymentApi } from '../cheer/api'
import { checkoutReturnUrls } from '../cheer/checkoutFlow'
import { languageOf, useT } from '../i18n'

/**
 * 결제를 시작한 보류의 결제 자리 - 주문(`itemType: "booking"`, `itemRef: 보류 id`)을 만들어 결제창을 연다.
 * 금액은 서버가 결제 시작 때 박은 값이다(브라우저가 정하지 않는다). 결제창을 닫아도 보류는 그대로고 다시 열 수 있다.
 * 돌아오는 주소는 응원하기와 같은 `/payments/return`.
 */
export function BookingPayment({ holdId }: { holdId: string }) {
  const { t, locale } = useT()
  const createOrder = useCreateOrder(paymentApi)
  const [failed, setFailed] = useState(false)

  async function open() {
    setFailed(false)
    try {
      const created = await createOrder.mutateAsync({
        itemType: 'booking',
        itemRef: holdId,
        returnOrigin: window.location.origin,
      })
      const checkout: Checkout | null = checkoutToOpen(created)
      if (checkout === null) return // 결제할 것이 없는 주문(이미 끝난 주문)
      await openCheckout(checkout, {
        ...checkoutReturnUrls(window.location.origin, created.order.id, checkout.provider),
        locale: languageOf(locale),
      })
    } catch {
      setFailed(true)
    }
  }

  return (
    <>
      {failed && <Alert tone="danger">{t('booking.pay.failed')}</Alert>}
      <Button onClick={() => void open()} loading={createOrder.isPending}>
        {t('booking.pay.open')}
      </Button>
    </>
  )
}
