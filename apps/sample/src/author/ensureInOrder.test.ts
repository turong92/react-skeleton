import { describe, expect, it, vi } from 'vitest'
import { ensureInOrder } from './ensureInOrder'

describe('ensureInOrder - the checks before a write run in order and stop at the first one that opened a dialog', () => {
  it('is true when every check passes, and runs them all in order', () => {
    const calls: string[] = []
    const email = vi.fn(() => (calls.push('email'), true))
    const nickname = vi.fn(() => (calls.push('nickname'), true))
    expect(ensureInOrder(email, nickname)).toBe(true)
    expect(calls).toEqual(['email', 'nickname'])
  })

  it('stops at the email check: the nickname dialog is not opened on top of the email screen', () => {
    const nickname = vi.fn(() => true)
    expect(ensureInOrder(() => false, nickname)).toBe(false)
    expect(nickname).not.toHaveBeenCalled()
  })

  it('asks for the nickname once the email is no longer needed', () => {
    const nickname = vi.fn(() => false)
    expect(ensureInOrder(() => true, nickname)).toBe(false)
    expect(nickname).toHaveBeenCalledTimes(1)
  })
})
