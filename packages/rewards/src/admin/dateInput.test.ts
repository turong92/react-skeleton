import { describe, expect, it } from 'vitest'
import { fromLocalInput, toLocalInput } from './dateInput'

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
