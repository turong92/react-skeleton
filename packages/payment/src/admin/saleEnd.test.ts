import { describe, expect, it } from 'vitest'
import { toLocalInput, validateSaleEnd } from './saleEnd'

describe('saleEnd', () => {
  it('round-trips an instant through the local input', () => {
    const iso = '2026-11-30T12:34:00.000Z'
    expect(validateSaleEnd(toLocalInput(iso), null)).toEqual({ value: iso, problem: null })
    expect(toLocalInput(null)).toBe('')
  })

  it('empty means no end', () => {
    expect(validateSaleEnd('', '2026-11-01T00:00:00Z')).toEqual({ value: null, problem: null })
  })

  it('the end must be after the start, and must be a time', () => {
    expect(validateSaleEnd('2026-11-01T00:00', '2026-12-01T00:00:00Z').problem).toBe(
      'endBeforeStart',
    )
    expect(validateSaleEnd('nonsense', null).problem).toBe('timeInvalid')
  })
})
