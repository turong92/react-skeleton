import { SeatBooking } from '@skeleton/booking'
import { WaitingRoomGate } from '@skeleton/waiting-room'
import { PageHeader, Spinner } from '@skeleton/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { bookingApi, bookingSse, waitingRoomApi } from '../booking/api'
import { BookingPayment } from '../booking/BookingPayment'
import { bookingLabelsFor, waitingRoomLabelsFor } from '../booking/labels'
import { LoadError } from '../components/LoadError'
import { languageOf, useT } from '../i18n'

/**
 * 자리 고르기 `/booking/:poolId` - 풀에 대기실이 달려 있으면 문(`WaitingRoomGate`) 안에서 배치도(`SeatBooking`)를 연다.
 * 자리 판정은 서버가 찍는 순간 한다. 결제는 `BookingPayment`(주문 `itemType: "booking"`).
 */
export function BookingSeatsPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const { poolId = '' } = useParams()
  const pool = useQuery({
    queryKey: ['booking', 'pool', poolId],
    queryFn: () => bookingApi.pool(poolId),
  })
  if (pool.isPending) return <Spinner label={t('common.loading')} />
  if (pool.data === undefined)
    return (
      <LoadError
        title={t('booking.loadFailed')}
        error={pool.error}
        onRetry={() => void pool.refetch()}
      />
    )
  const seats = (
    <SeatBooking
      api={bookingApi}
      pool={pool.data}
      sse={bookingSse}
      locale={locale}
      labels={bookingLabelsFor(language)}
      renderPayment={({ holdId }) => <BookingPayment holdId={holdId} />}
    />
  )
  return (
    <>
      <PageHeader title={pool.data.name} description={t('booking.seats.subtitle')} />
      {pool.data.waitingRoomId ? (
        <WaitingRoomGate
          api={waitingRoomApi}
          roomId={pool.data.waitingRoomId}
          labels={waitingRoomLabelsFor(language)}
        >
          {seats}
        </WaitingRoomGate>
      ) : (
        seats
      )}
    </>
  )
}
