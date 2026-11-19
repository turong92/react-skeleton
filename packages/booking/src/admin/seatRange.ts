import type { NewSeat } from './types'

/** 한 번에 펼칠 수 있는 자리 수 - 입력 실수로 요청 본문이 터지지 않게 */
export const MAX_SEATS_PER_RANGE = 2000

export type SeatRangeInput = {
  section: string
  /** 열: `A` · `A-C`(영문 한 글자 범위) · `1` · `1-5`(정수 범위) */
  rows: string
  /** 번호: `7` 또는 `1-12` */
  numbers: string
  grade: string
  /** 통화 최소 단위 정수, 비우면 무료 */
  price?: number
}

export type SeatRangeResult =
  | { ok: true; seats: NewSeat[] }
  | { ok: false; problem: 'section' | 'grade' | 'rows' | 'numbers' | 'price' | 'tooMany' }

function span(text: string): number[] | null {
  const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(text)
  if (!m) return null
  const from = Number(m[1])
  const to = m[2] === undefined ? from : Number(m[2])
  if (to < from || to - from >= MAX_SEATS_PER_RANGE) return null
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

function rowLabels(text: string): string[] | null {
  const letters = /^\s*([A-Za-z])\s*(?:-\s*([A-Za-z])\s*)?$/.exec(text)
  if (letters) {
    const from = letters[1].toUpperCase().charCodeAt(0)
    const to = (letters[2] ?? letters[1]).toUpperCase().charCodeAt(0)
    if (to < from) return null
    return Array.from({ length: to - from + 1 }, (_, i) => String.fromCharCode(from + i))
  }
  return span(text)?.map(String) ?? null
}

/** 「구역 · 열 범위 · 번호 범위 · 등급 · 가격」 입력을 자리 목록으로 펼친다 - 열마다 번호 범위가 같다 */
export function expandSeatRange(input: SeatRangeInput): SeatRangeResult {
  if (!input.section.trim()) return { ok: false, problem: 'section' }
  if (!input.grade.trim()) return { ok: false, problem: 'grade' }
  if (input.price !== undefined && (!Number.isInteger(input.price) || input.price < 0))
    return { ok: false, problem: 'price' }
  const rows = rowLabels(input.rows)
  if (!rows) return { ok: false, problem: 'rows' }
  const numbers = span(input.numbers)
  if (!numbers || numbers[0] < 1) return { ok: false, problem: 'numbers' }
  if (rows.length * numbers.length > MAX_SEATS_PER_RANGE) return { ok: false, problem: 'tooMany' }
  const seats = rows.flatMap((row) =>
    numbers.map((number) => ({
      section: input.section.trim(),
      row,
      number,
      grade: input.grade.trim(),
      ...(input.price === undefined ? {} : { price: input.price }),
    })),
  )
  return { ok: true, seats }
}
