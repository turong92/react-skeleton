import { defaultBookingLabels } from './labels.en'
import type { BookingProblem } from './errors'

export type SeatLabelInput = {
  section: string
  row: string
  number: number
  grade: string
  /** 이미 포맷한 가격, 무료면 undefined */
  price?: string
  stateName: string
}

export type BookingLabels = {
  map: {
    loading: string
    empty: string
    reconnecting: string
    /** 입장권이 없어 자리를 못 잡을 때 */
    entryMissing: string
    section: (section: string) => string
    row: (row: string) => string
    /** 단추의 읽히는 이름 - 「A구역 3열 12번 R석, 선택 불가」 */
    seat: (input: SeatLabelInput) => string
    legendTitle: string
    states: { open: string; mine: string; taken: string }
  }
  hold: {
    title: string
    empty: string
    seatLine: (input: { section: string; row: string; number: number; grade: string }) => string
    free: string
    total: string
    remaining: (clock: string) => string
    expired: string
    confirm: string
    checkout: string
    leave: string
    /** 결제를 시작해 자리를 바꿀 수 없을 때 */
    locked: string
    confirmed: string
    unfulfilled: string
  }
  problems: Record<BookingProblem, string>
  mine: {
    title: string
    empty: string
    cancel: string
    paidNote: string
    unfulfilled: string
  }
}

/** 일부만 바꾸는 입력 */
export type BookingLabelsInput = { [K in keyof BookingLabels]?: Partial<BookingLabels[K]> }

export { defaultBookingLabels } from './labels.en'
export { koBookingLabels } from './labels.ko'

export function resolveBookingLabels(input: BookingLabelsInput = {}): BookingLabels {
  return {
    map: { ...defaultBookingLabels.map, ...input.map },
    hold: { ...defaultBookingLabels.hold, ...input.hold },
    problems: { ...defaultBookingLabels.problems, ...input.problems },
    mine: { ...defaultBookingLabels.mine, ...input.mine },
  }
}
