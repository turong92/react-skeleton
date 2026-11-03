export type BookingAdminLabels = {
  title: string
  pools: { choose: string; none: string; status: Record<'ACTIVE' | 'PAUSED' | 'CLOSED', string> }
  create: {
    title: string
    name: string
    opensAt: string
    closesAt: string
    maxPerHold: string
    maxPerHoldHint: string
    perAccountLimit: string
    currency: string
    currencyHint: string
    holdMinutes: string
    waitingRoomId: string
    submit: string
    invalid: string
  }
  stats: Record<'total' | 'available' | 'held' | 'sold' | 'blocked' | 'unfulfilled', string> & {
    unfulfilledHint: string
  }
  actions: {
    pause: string
    resume: string
    close: string
    closeTitle: string
    closeBody: string
    closeConfirm: string
    cancel: string
  }
  seats: {
    title: string
    section: string
    rows: string
    rowsHint: string
    numbers: string
    numbersHint: string
    grade: string
    price: string
    priceHint: string
    submit: string
    added: (count: number) => string
    problems: Record<'section' | 'grade' | 'rows' | 'numbers' | 'price' | 'tooMany', string>
    exists: string
  }
  block: {
    title: string
    hint: string
    selected: string
    block: string
    unblock: string
    done: (count: number) => string
    inUse: string
  }
  failed: string
}

export const defaultBookingAdminLabels: BookingAdminLabels = {
  title: 'Booking pools',
  pools: {
    choose: 'Pool',
    none: 'There are no pools yet. Create one below.',
    status: { ACTIVE: 'On sale', PAUSED: 'Paused', CLOSED: 'Closed' },
  },
  create: {
    title: 'Create a pool',
    name: 'Name',
    opensAt: 'Opens at',
    closesAt: 'Sales end (optional)',
    maxPerHold: 'Seats one person may take at once',
    maxPerHoldHint: 'Required. With no limit one person could take every seat.',
    perAccountLimit: 'Seats one account may hold in all (optional)',
    currency: 'Currency (optional)',
    currencyHint: 'Needed when a seat has a price, e.g. KRW.',
    holdMinutes: 'Minutes a seat is held (default 10)',
    waitingRoomId: 'Waiting room id (optional)',
    submit: 'Create pool',
    invalid: 'Check the name, the opening time and the seats limit.',
  },
  stats: {
    total: 'Seats',
    available: 'Available',
    held: 'Held',
    sold: 'Sold',
    blocked: 'Blocked',
    unfulfilled: 'Paid without seats',
    unfulfilledHint: 'A refund is queued for each.',
  },
  actions: {
    pause: 'Pause sales',
    resume: 'Resume sales',
    close: 'Close this pool',
    closeTitle: 'Close this pool?',
    closeBody: 'Nobody can pick seats any more. This cannot be undone.',
    closeConfirm: 'Close it',
    cancel: 'Cancel',
  },
  seats: {
    title: 'Add seats',
    section: 'Section',
    rows: 'Rows',
    rowsHint: 'A, A-C, 3 or 1-5',
    numbers: 'Seat numbers',
    numbersHint: 'for example 1-12',
    grade: 'Grade',
    price: 'Price (smallest currency unit)',
    priceHint: 'Leave empty for free seats.',
    submit: 'Add seats',
    added: (count) => `Added ${count} seats.`,
    problems: {
      section: 'Enter a section.',
      grade: 'Enter a grade.',
      rows: 'Rows look like A, A-C, 3 or 1-5.',
      numbers: 'Numbers look like 7 or 1-12.',
      price: 'The price is a whole number of 0 or more.',
      tooMany: 'That is too many seats at once. Add them in parts.',
    },
    exists: 'Some of those seats already exist, so none were added.',
  },
  block: {
    title: 'Block or unblock seats',
    hint: 'Pick seats on the map. Held or sold seats cannot be blocked.',
    selected: 'Selected',
    block: 'Block selected',
    unblock: 'Unblock selected',
    done: (count) => `Changed ${count} seats.`,
    inUse: 'Some of those seats are held or sold, so none were blocked.',
  },
  failed: 'That did not go through. Try again.',
}

export const koBookingAdminLabels: BookingAdminLabels = {
  title: '예약 풀',
  pools: {
    choose: '풀',
    none: '아직 풀이 없어요. 아래에서 만들어요.',
    status: { ACTIVE: '판매 중', PAUSED: '멈춤', CLOSED: '닫힘' },
  },
  create: {
    title: '풀 만들기',
    name: '이름',
    opensAt: '오픈 시각',
    closesAt: '판매 끝 (선택)',
    maxPerHold: '한 번에 잡는 자리 수 상한',
    maxPerHoldHint: '필수예요. 상한이 없으면 한 사람이 자리를 다 잡을 수 있어요.',
    perAccountLimit: '계정당 총 자리 한도 (선택)',
    currency: '통화 (선택)',
    currencyHint: '가격이 있는 자리가 있으면 필요해요. 예: KRW',
    holdMinutes: '자리를 쥐고 있는 시간(분, 기본 10)',
    waitingRoomId: '대기실 id (선택)',
    submit: '풀 만들기',
    invalid: '이름, 오픈 시각, 자리 수 상한을 확인해 주세요.',
  },
  stats: {
    total: '전체 자리',
    available: '선택 가능',
    held: '보류 중',
    sold: '팔림',
    blocked: '막음',
    unfulfilled: '결제했지만 자리 없음',
    unfulfilledHint: '건마다 환불 작업이 걸려 있어요.',
  },
  actions: {
    pause: '판매 멈춤',
    resume: '판매 다시 시작',
    close: '풀 닫기',
    closeTitle: '풀을 닫을까요?',
    closeBody: '더 이상 아무도 자리를 고를 수 없어요. 되돌릴 수 없어요.',
    closeConfirm: '닫기',
    cancel: '취소',
  },
  seats: {
    title: '자리 넣기',
    section: '구역',
    rows: '열',
    rowsHint: 'A, A-C, 3 또는 1-5',
    numbers: '번호',
    numbersHint: '예: 1-12',
    grade: '등급',
    price: '가격 (통화 최소 단위)',
    priceHint: '무료 자리는 비워 둬요.',
    submit: '자리 넣기',
    added: (count) => `자리 ${count}개를 넣었어요.`,
    problems: {
      section: '구역을 적어 주세요.',
      grade: '등급을 적어 주세요.',
      rows: '열은 A, A-C, 3, 1-5 꼴로 적어요.',
      numbers: '번호는 7 또는 1-12 꼴로 적어요.',
      price: '가격은 0 이상의 정수예요.',
      tooMany: '한 번에 넣기엔 너무 많아요. 나눠서 넣어 주세요.',
    },
    exists: '이미 있는 자리가 있어서 하나도 넣지 못했어요.',
  },
  block: {
    title: '자리 막기 / 풀기',
    hint: '배치도에서 자리를 골라요. 잡히거나 팔린 자리는 막을 수 없어요.',
    selected: '고른 자리',
    block: '고른 자리 막기',
    unblock: '고른 자리 풀기',
    done: (count) => `자리 ${count}개를 바꿨어요.`,
    inUse: '잡히거나 팔린 자리가 있어서 하나도 막지 못했어요.',
  },
  failed: '처리하지 못했어요. 다시 시도해 주세요.',
}
