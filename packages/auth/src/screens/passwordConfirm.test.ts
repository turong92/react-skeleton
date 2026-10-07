import { describe, expect, it } from 'vitest'
import { confirmProblem, confirmVisible } from './passwordConfirm'

describe('confirmProblem', () => {
  it('is fine when both fields hold the same text (including both empty: the password field itself reports that)', () => {
    expect(confirmProblem('Correct-horse-9', 'Correct-horse-9')).toBeNull()
    expect(confirmProblem('', '')).toBeNull()
  })
  it('tells an empty confirmation apart from a different one', () => {
    expect(confirmProblem('Correct-horse-9', '')).toBe('missing')
    expect(confirmProblem('Correct-horse-9', 'Correct-horse-8')).toBe('mismatch')
  })
  it('compares exactly: no trimming, no case folding', () => {
    expect(confirmProblem('abc', 'abc ')).toBe('mismatch')
    expect(confirmProblem('abc', 'ABC')).toBe('mismatch')
  })
})

describe('confirmVisible', () => {
  it('stays quiet until the confirm field was touched or a submit was tried', () => {
    expect(confirmVisible({ touched: false, attempted: false, problem: 'mismatch' })).toBe(false)
    expect(confirmVisible({ touched: true, attempted: false, problem: 'mismatch' })).toBe(true)
    expect(confirmVisible({ touched: false, attempted: true, problem: 'missing' })).toBe(true)
  })
  it('shows nothing when there is no problem', () => {
    expect(confirmVisible({ touched: true, attempted: true, problem: null })).toBe(false)
  })
})
