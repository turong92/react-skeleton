import { describe, expect, it } from 'vitest'
import { expiresAtFor, expiryChoices } from './expiry'

describe('expiryChoices', () => {
  it('offers 30 / 90 / 365 days and "never" when the app sets no lifetime cap', () => {
    expect(expiryChoices()).toEqual([30, 90, 365, null])
  })
  it('hides "never" and anything longer than the app cap (the server would refuse them)', () => {
    expect(expiryChoices(365)).toEqual([30, 90, 365])
    expect(expiryChoices(90)).toEqual([30, 90])
  })
  it('keeps at least the cap itself when it falls between the presets', () => {
    expect(expiryChoices(60)).toEqual([30, 60])
  })
})

describe('expiresAtFor', () => {
  it('is an ISO instant N days after now, and undefined for "never"', () => {
    const now = Date.parse('2026-10-31T00:00:00Z')
    expect(expiresAtFor(30, now)).toBe('2026-11-30T00:00:00.000Z')
    expect(expiresAtFor(null, now)).toBeUndefined()
  })
  it('keeps a minute of slack under the app cap so a browser clock a little ahead of the server is not refused', () => {
    const now = Date.parse('2026-10-31T00:00:00Z')
    expect(expiresAtFor(365, now, 365)).toBe('2027-10-30T23:59:00.000Z')
    expect(expiresAtFor(30, now, 365)).toBe('2026-11-30T00:00:00.000Z')
  })
})
