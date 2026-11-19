import { describe, expect, it } from 'vitest'
import { expandSeatRange, MAX_SEATS_PER_RANGE } from './seatRange'

describe('expandSeatRange', () => {
  it('spreads rows and numbers into one seat each, with the grade and the price', () => {
    const result = expandSeatRange({
      section: 'A',
      rows: 'A-B',
      numbers: '1-3',
      grade: 'R',
      price: 50000,
    })
    expect(result).toEqual({ ok: true, seats: expect.any(Array) })
    if (!result.ok) return
    expect(result.seats.map((s) => `${s.row}${s.number}`)).toEqual([
      'A1',
      'A2',
      'A3',
      'B1',
      'B2',
      'B3',
    ])
    expect(
      result.seats.every((s) => s.price === 50000 && s.grade === 'R' && s.section === 'A'),
    ).toBe(true)
  })

  it('leaves the price out for free seats, and takes a single row or number', () => {
    expect(expandSeatRange({ section: 'S', rows: '3', numbers: '7', grade: 'F' })).toEqual({
      ok: true,
      seats: [{ section: 'S', row: '3', number: 7, grade: 'F' }],
    })
  })

  it('refuses a backwards range, a range that is too big, and a bad price instead of sending a huge or wrong list', () => {
    expect(expandSeatRange({ section: 'A', rows: 'C-A', numbers: '1', grade: 'R' })).toEqual({
      ok: false,
      problem: 'rows',
    })
    expect(expandSeatRange({ section: 'A', rows: '1', numbers: '5-2', grade: 'R' })).toEqual({
      ok: false,
      problem: 'numbers',
    })
    expect(
      expandSeatRange({
        section: 'A',
        rows: '1-100',
        numbers: `1-${MAX_SEATS_PER_RANGE / 10}`,
        grade: 'R',
      }),
    ).toEqual({ ok: false, problem: 'tooMany' })
    expect(
      expandSeatRange({ section: 'A', rows: 'A', numbers: '1', grade: 'R', price: -1 }),
    ).toEqual({ ok: false, problem: 'price' })
  })
})
