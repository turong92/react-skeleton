import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { koBookingLabels } from '../labels'
import { SeatBooking } from '../SeatBooking'
import { createFakeBooking, fakePool } from './fakeBooking'

/** 스토리용 한 벌 - 가짜 서버를 한 번만 만들고, 「다른 분이 잡았다」 단추로 다른 사람의 사건을 흘린다 */
export function BookingDemo() {
  const [server] = useState(createFakeBooking)
  return (
    <div>
      <SeatBooking
        api={server.api}
        pool={fakePool}
        sse={server.sse}
        locale="ko-KR"
        labels={koBookingLabels}
        renderPayment={({ amount }) => <p>결제창 자리 {amount}</p>}
      />
      <Button variant="secondary" onClick={() => server.takeByOther('A3')}>
        다른 분이 A3 를 잡았다
      </Button>
      <Button variant="secondary" onClick={() => server.takeByOther('A1')}>
        다른 분이 A1 을 잡았다
      </Button>
    </div>
  )
}
