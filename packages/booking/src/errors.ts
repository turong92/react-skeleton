import { ApiRequestError } from '@skeleton/api-client'

/** 예약 요청 실패 하나를 한 낱말로 - 나머지는 `other`(일반 문장 + 참조 번호) */
export type BookingProblem =
  | 'seatTaken'
  | 'limitReached'
  | 'notOpen'
  | 'holdExpired'
  | 'holdLocked'
  | 'checkoutRequired'
  | 'notPayable'
  | 'entryRequired'
  | 'other'

const BY_CODE: Record<string, BookingProblem> = {
  'BOOKING.SEAT_TAKEN': 'seatTaken',
  'BOOKING.LIMIT_REACHED': 'limitReached',
  'BOOKING.NOT_OPEN': 'notOpen',
  'BOOKING.HOLD_EXPIRED': 'holdExpired',
  'BOOKING.HOLD_LOCKED': 'holdLocked',
  'BOOKING.CHECKOUT_REQUIRED': 'checkoutRequired',
  'BOOKING.NOT_PAYABLE': 'notPayable',
  'WAITING_ROOM.ENTRY_REQUIRED': 'entryRequired',
}

export function bookingProblem(error: unknown): BookingProblem {
  const code = error instanceof ApiRequestError ? error.apiError.code : undefined
  return (code && BY_CODE[code]) || 'other'
}

/** `409 BOOKING.SEAT_TAKEN` 의 `data.seatIds` - 못 잡은 자리 전부 */
export function takenSeatIds(error: unknown): string[] {
  if (!(error instanceof ApiRequestError)) return []
  const ids = (error.apiError.data as { seatIds?: unknown } | undefined)?.seatIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}
