import { describe, expect, it } from 'vitest'
import { fromLocalInput, startsBefore, toLocalInput } from './dateInput'

describe('date inputs', () => {
  it('round-trips through the local datetime box', () => {
    const iso = '2026-10-28T03:30:00.000Z'
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso)
  })
  it('empty or unreadable is empty / null', () => {
    expect(toLocalInput(null)).toBe('')
    expect(toLocalInput('nope')).toBe('')
    expect(fromLocalInput('')).toBeNull()
  })
})

describe('startsBefore', () => {
  it('needs the start strictly before the end, and only judges when both are there', () => {
    expect(startsBefore('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z')).toBe(true)
    expect(startsBefore('2026-10-02T00:00:00Z', '2026-10-02T00:00:00Z')).toBe(false)
    expect(startsBefore('2026-10-03T00:00:00Z', '2026-10-02T00:00:00Z')).toBe(false)
    expect(startsBefore(null, '2026-10-02T00:00:00Z')).toBe(true)
    expect(startsBefore('2026-10-02T00:00:00Z', null)).toBe(true)
  })
})
