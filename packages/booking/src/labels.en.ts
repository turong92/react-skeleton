import type { BookingLabels } from './labels'

export const defaultBookingLabels: BookingLabels = {
  map: {
    loading: 'Loading the seat map…',
    empty: 'There are no seats yet.',
    reconnecting: 'Reconnecting… the map may be out of date.',
    entryMissing: 'You need a place in the line to pick seats.',
    section: (section) => `Section ${section}`,
    row: (row) => `Row ${row}`,
    seat: ({ section, row, number, grade, price, stateName }) =>
      `Section ${section} row ${row} seat ${number}, grade ${grade}${price ? `, ${price}` : ''}, ${stateName}`,
    legendTitle: 'Seat colours',
    states: { open: 'Available', mine: 'Yours', taken: 'Not available' },
  },
  hold: {
    title: 'Your seats',
    empty: 'Press a seat on the map to pick it.',
    seatLine: ({ section, row, number, grade }) => `${section} ${row}-${number} (${grade})`,
    free: 'Free',
    total: 'Total',
    remaining: (clock) => `Time left ${clock}`,
    expired: 'The time is up and the seats were released.',
    confirm: 'Confirm booking',
    checkout: 'Go to payment',
    leave: 'Leave',
    locked:
      'Payment has started, so the seats cannot be changed. To pick others, leave and start over.',
    confirmed: 'Your booking is confirmed.',
    unfulfilled: 'We could not give you the seats. You will be refunded.',
  },
  problems: {
    seatTaken: 'Someone else took that seat first.',
    limitReached: 'That is more seats than you can take at once.',
    notOpen: 'Seats cannot be picked right now.',
    holdExpired: 'The time is up and the seats were released.',
    holdLocked: 'Payment has started, so the seats cannot be changed.',
    checkoutRequired: 'Start the payment first.',
    notPayable: 'These seats cannot be paid for.',
    entryRequired: 'You need a place in the line. Join the line again.',
    other: 'That did not go through. Try again.',
  },
  mine: {
    title: 'My bookings',
    empty: 'You have no bookings yet.',
    cancel: 'Cancel booking',
    paidNote: 'Paid bookings are refunded from your payment history.',
    unfulfilled: 'We could not give you the seats. You will be refunded.',
  },
}
