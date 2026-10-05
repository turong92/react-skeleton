import { describe, expect, it } from 'vitest'
import { clampDate, isIsoDate, rangeProblem } from './dates'

describe('isIsoDate', () => {
  it.each(['2026-10-06', '2024-02-29', '1999-12-31'])('%s is a real calendar date', (value) =>
    expect(isIsoDate(value)).toBe(true),
  )
  it.each([
    '',
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '2026-1-1',
    '10/06/2026',
    'tomorrow',
    '2026-10-06T00:00',
  ])('%j is not', (value) => expect(isIsoDate(value)).toBe(false))
})

describe('clampDate', () => {
  it('pulls a date into [min, max] (either may be missing); an empty value stays empty', () => {
    expect(clampDate('2026-10-06', '2026-10-10', undefined)).toBe('2026-10-10')
    expect(clampDate('2026-10-06', undefined, '2026-10-01')).toBe('2026-10-01')
    expect(clampDate('2026-10-06', '2026-10-01', '2026-10-31')).toBe('2026-10-06')
    expect(clampDate('', '2026-10-01', undefined)).toBe('')
  })
})

describe('rangeProblem', () => {
  it('is "order" only when both ends are dates and end is before start', () => {
    expect(rangeProblem('2026-10-06', '2026-10-05')).toBe('order')
    expect(rangeProblem('2026-10-06', '2026-10-06')).toBeNull()
    expect(rangeProblem('2026-10-06', '')).toBeNull()
    expect(rangeProblem('', '2026-10-05')).toBeNull()
  })
})
