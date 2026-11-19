import type { BookingLabels } from './labels'

export const koBookingLabels: BookingLabels = {
  map: {
    loading: '배치도를 불러오는 중이에요…',
    empty: '아직 자리가 없어요.',
    reconnecting: '다시 연결하는 중이에요… 배치도가 최신이 아닐 수 있어요.',
    entryMissing: '자리를 고르려면 대기열에서 차례가 되어야 해요.',
    section: (section) => `${section}구역`,
    row: (row) => `${row}열`,
    seat: ({ section, row, number, grade, price, stateName }) =>
      `${section}구역 ${row}열 ${number}번 ${grade}석${price ? `, ${price}` : ''}, ${stateName}`,
    legendTitle: '자리 색',
    states: { open: '선택 가능', mine: '내 자리', taken: '선택 불가' },
  },
  hold: {
    title: '내가 고른 자리',
    empty: '배치도에서 자리를 눌러 골라요.',
    seatLine: ({ section, row, number, grade }) =>
      `${section}구역 ${row}열 ${number}번 (${grade}석)`,
    free: '무료',
    total: '합계',
    remaining: (clock) => `남은 시간 ${clock}`,
    expired: '시간이 지나 자리가 풀렸어요.',
    confirm: '예약 확정',
    checkout: '결제하기',
    leave: '나가기',
    locked:
      '결제를 시작해서 자리를 바꿀 수 없어요. 다른 자리를 고르려면 나가기를 누르고 다시 골라요.',
    confirmed: '예약이 확정됐어요.',
    unfulfilled: '자리를 드리지 못했어요. 결제하신 금액은 환불돼요.',
  },
  problems: {
    seatTaken: '다른 분이 먼저 잡았어요.',
    limitReached: '한 번에 잡을 수 있는 자리 수를 넘었어요.',
    notOpen: '지금은 자리를 고를 수 없어요.',
    holdExpired: '시간이 지나 자리가 풀렸어요.',
    holdLocked: '결제 중이라 자리를 바꿀 수 없어요.',
    checkoutRequired: '결제를 먼저 시작해 주세요.',
    notPayable: '결제할 수 없는 자리예요.',
    entryRequired: '입장 차례가 필요해요. 대기열에서 다시 줄을 서 주세요.',
    other: '처리하지 못했어요. 다시 시도해 주세요.',
  },
  mine: {
    title: '내 예약',
    empty: '아직 예약이 없어요.',
    cancel: '예약 취소',
    paidNote: '결제한 예약은 결제 내역에서 환불해요.',
    unfulfilled: '자리를 드리지 못했어요. 결제하신 금액은 환불돼요.',
  },
}
