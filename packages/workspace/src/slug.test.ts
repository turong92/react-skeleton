import { describe, expect, it } from 'vitest'
import { slugFromName, slugProblem } from './slug'

describe('slugProblem (the server rule: 3-40 chars, a-z 0-9 and hyphens, no hyphen at either end)', () => {
  it('accepts valid addresses', () => {
    for (const slug of ['abc', 'acme-team', 'a1b', 'team-2', 'a'.repeat(40)])
      expect(slugProblem(slug), slug).toBeNull()
  })
  it('names the length problem before the format problem', () => {
    expect(slugProblem('ab')).toBe('length')
    expect(slugProblem('a'.repeat(41))).toBe('length')
    expect(slugProblem('')).toBe('length')
  })
  it('rejects capitals, spaces, symbols and hyphens at the ends', () => {
    for (const slug of ['Acme', 'ac me', 'ac_me', '-acme', 'acme-', 'ac.me', '팀팀팀'])
      expect(slugProblem(slug), slug).toBe('format')
  })
})

describe('slugFromName (a suggestion for the address while typing the name)', () => {
  it('lowercases, drops accents and turns runs of other characters into one hyphen', () => {
    expect(slugFromName('Acme  Team!')).toBe('acme-team')
    expect(slugFromName('Café Münster')).toBe('cafe-munster')
    expect(slugFromName('  --My_Team--  ')).toBe('my-team')
  })
  it('is empty when nothing usable is left, so the server picks the address', () => {
    expect(slugFromName('우리 팀')).toBe('')
    expect(slugFromName('a')).toBe('')
    expect(slugFromName('')).toBe('')
  })
  it('stays within 40 characters without a hyphen at the end', () => {
    const slug = slugFromName(`${'word '.repeat(20)}`)
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slugProblem(slug)).toBeNull()
  })
})
