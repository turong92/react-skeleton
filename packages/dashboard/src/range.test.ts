import { describe, expect, it } from 'vitest'
import { addDays, daysIn, spanOf, spanProblem } from './range'

// 2026-10-26 15:30Z 는 서울에서는 27일 새벽, 상파울루에서는 26일 낮
const now = new Date('2026-10-26T15:30:00Z')

describe('spanOf', () => {
  it('today is one day, counted in the dashboard zone', () => {
    expect(spanOf('today', 'Asia/Seoul', undefined, now)).toEqual({
      from: '2026-10-27',
      to: '2026-10-27',
    })
    expect(spanOf('today', 'America/Sao_Paulo', undefined, now)).toEqual({
      from: '2026-10-26',
      to: '2026-10-26',
    })
  })

  it('7 and 30 days end today and include it', () => {
    expect(spanOf('7d', 'UTC', undefined, now)).toEqual({ from: '2026-10-20', to: '2026-10-26' })
    expect(daysIn(spanOf('30d', 'UTC', undefined, now))).toBe(30)
  })

  it('custom is the picked dates as they are', () => {
    expect(spanOf('custom', 'UTC', { from: '2026-09-01', to: '2026-09-30' }, now)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
  })
})

describe('addDays / spanProblem', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('rejects a reversed span and one beyond 366 days, accepts 366', () => {
    expect(spanProblem({ from: '2026-10-02', to: '2026-10-01' })).toBe('order')
    expect(spanProblem({ from: '2025-10-25', to: '2026-10-26' })).toBe('long') // 367일
    expect(spanProblem({ from: '2025-10-26', to: '2026-10-26' })).toBeNull() // 366일
    expect(spanProblem({ from: '2026-10-26', to: '2026-10-26' })).toBeNull()
  })
})
