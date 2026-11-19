import { MyBookings } from '@skeleton/booking'
import { PageHeader } from '@skeleton/ui'
import { bookingApi } from '../booking/api'
import { bookingLabelsFor } from '../booking/labels'
import { languageOf, useT } from '../i18n'

/** 내 예약 `/booking` - 확정한 예약(무료는 취소 가능, 유료는 결제 내역에서 환불)과 자리를 못 받아 환불 중인 예약 */
export function BookingPage() {
  const { t, locale } = useT()
  return (
    <>
      <PageHeader title={t('booking.title')} description={t('booking.subtitle')} />
      <MyBookings api={bookingApi} locale={locale} labels={bookingLabelsFor(languageOf(locale))} />
    </>
  )
}
