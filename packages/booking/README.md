# @skeleton/booking

좌석 지정 예약(공연 · 수업 자리 고르기) 사용자 화면 — 백엔드 `modules/booking`(+ `booking-jdbc`)의 짝. 배치도에서 자리를 직접 찍으면 그 자리가 잡히고(남에게는 바로 「선택 불가」), 놓는 길은 셋: 다시 눌러 풀기 · 나가기 · 보류 시간 끝. 판정은 늘 서버(DB)가 한다 — 화면은 흐름(SSE)과 스냅샷으로 보여 줄 뿐이고, 늦게 본 자리를 눌러도 `409 SEAT_TAKEN` 으로 바로 고쳐진다.

| 내보내기                                                                                 | 하는 일                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createBookingApi(client, { basePath? })`                                                | 풀 · 스냅샷 · 흐름 주소 · 자리 잡기(`X-Entry-Token`) / 놓기 · 내 보류 · 결제 시작(`checkout`) · 나가기(`release`) · 무료 확정 · 취소. 기본 경로 `/api/v1/booking`                                          |
| `SeatBooking`                                                                            | **한 벌** — 배치도 + 내 보류. 대기실을 단 풀(`pool.waitingRoomId`)이면 `WaitingRoomGate` 안에 두고, 입장권이 없으면(입장 시간이 끝났으면) 새 자리를 못 잡는다(이미 잡은 보류는 마칠 수 있다)               |
| `SeatMap`                                                                                | 구역 → 열 → 번호 격자. 세 상태(선택 가능 · 내 자리 · 선택 불가), 등급 범례, 응답 기다리는 자리만 잠김, 「다시 연결하는 중」 띠. 단추 이름 「A구역 3열 12번 R석, 선택 불가」                                |
| `HoldPanel`                                                                              | 고른 자리 · 금액 · 남은 시간(0 이면 확정 · 결제 잠김 + 「시간이 지나 자리가 풀렸어요」) · 무료 「예약 확정」 / 유료 「결제하기」 · 「나가기」. 결제 시작 뒤 `renderPayment` 자리                           |
| `useSeatFeed` · `createSeatFeed`                                                         | 흐름을 먼저 열고 `ready` 를 받으면 그동안 온 사건을 쥔 채 스냅샷을 읽어 자리마다 `v` 큰 쪽을 남긴다. 다시 열릴 때마다 되풀이. `heldUntil` 은 서버 시계(스냅샷 `serverTime` 으로 보정)로 스스로 열린다      |
| `useSeatHold` · `createHoldController`                                                   | 자리 누르기(잡기 / 놓기) · 결제 시작 · 나가기 · 확정. 요청은 한 줄로 보내고 같은 자리의 중복 누름은 버린다                                                                                                 |
| `MyBookings`                                                                             | 내 확정 예약(무료는 취소) · 자리를 못 받아 환불 중인 예약                                                                                                                                                  |
| `bookingProblem(error)` · `takenSeatIds(error)` · `formatMoney` · 문구 `koBookingLabels` | 실패를 한 낱말로(`seatTaken` · `holdLocked` · `checkoutRequired` …) · 금액 포맷                                                                                                                            |
| `@skeleton/booking/admin`                                                                | `createBookingAdminApi` · `AdminBookingPools`(풀 만들기 · 「구역 · 열 범위 · 번호 범위 · 등급 · 가격」으로 자리 넣기 · 배치도에서 골라 막기 / 풀기 · 판매 멈춤 / 닫기 · 현황 5초 갱신) · `expandSeatRange` |

```tsx
const bookingApi = createBookingApi(apiClient)
const sse = { getAuthHeaders, recoverUnauthorized } // 알림 흐름을 붙일 때와 같은 것, 한 번 만들어 둔다

// 대기실을 단 풀 — 입장하면 SeatBooking 이 그려진다
<WaitingRoomGate api={waitingRoomApi} roomId={pool.waitingRoomId}>
  <SeatBooking
    api={bookingApi}
    pool={pool}
    sse={sse}
    renderPayment={({ holdId, amount, currency, onPaid }) => (
      <PayWithPaymentPackage itemType="booking" itemRef={holdId} amount={amount} onPaid={onPaid} />
    )}
  />
</WaitingRoomGate>
```

- **결제 순서**: 자리 고르기 → 「결제하기」(`POST /booking/holds/{id}/checkout` — 금액(자리 가격 합)을 박고 자리를 고정, 멱등) → 앱이 `POST /payments/orders {itemType: "booking", itemRef: holdId}` + `Idempotency-Key`. 시작하지 않은 보류의 주문은 `409 BOOKING.CHECKOUT_REQUIRED`(`bookingProblem` → `checkoutRequired`).
- 결제를 시작한 뒤 자리 더하기 · 빼기는 `409 HOLD_LOCKED`(화면: 「결제 중이라 자리를 바꿀 수 없어요」). **나가기는 잠금 뒤에도 된다** — 자리가 바로 돌아온다. 새로고침하면 화면은 잠금 여부를 모른다(응답에 없음): 「결제하기」를 다시 누르면 같은 보류로 이어지고(멱등), 자리를 누르면 `HOLD_LOCKED` 로 알려 준다.
- 보류 타이머는 첫 자리부터 재고, 결제를 시작해도 늘지 않는다. **새로고침 · 탭 닫기에는 놓지 않는다**(결제사 리다이렉트도 페이지를 떠나는 것이라) — 타이머가 푼다.
- 흐름은 서버가 15초마다 심장박동을 보내고 30분에 닫는다 — 클라이언트는 45초 무소식이면 끊고 다시 붙고, 닫혔어도 다시 붙으며 스냅샷을 다시 읽는다. 대기실 입장권은 연결할 때 헤더로 간다(`createEntryHeaders`).
- 금액은 통화 최소 단위 정수(`formatMoney` 가 통화의 소수 자리로 나눈다). 가격이 없는 자리는 무료.
- 스토리: `Packages/booking/SeatMap` · `HoldPanel` · `SeatBooking` · `admin/AdminBookingPools`.
