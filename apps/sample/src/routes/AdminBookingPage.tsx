import { AdminBookingPools } from '@skeleton/booking/admin'
import { PageHeader } from '@skeleton/ui'
import { bookingAdminApi, bookingApi } from '../booking/api'
import { bookingAdminLabelsFor, bookingLabelsFor } from '../booking/labels'
import { languageOf, useT } from '../i18n'

/** 운영자 화면 `/admin/booking` - 풀 만들기 · 자리 범위 넣기 · 막기 / 풀기 · 현황. 백엔드 권한 `booking.read` · `booking.manage` */
export function AdminBookingPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  return (
    <>
      <PageHeader title={t('booking.admin.title')} description={t('booking.admin.subtitle')} />
      <AdminBookingPools
        api={bookingAdminApi}
        bookingApi={bookingApi}
        mapLabels={bookingLabelsFor(language)}
        labels={bookingAdminLabelsFor(language)}
      />
    </>
  )
}
