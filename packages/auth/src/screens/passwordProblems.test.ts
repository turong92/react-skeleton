import { describe, expect, it } from 'vitest'
import { FAKE_POLICY } from '../test/apiFixtures'
import { defaultAuthLabels as labels } from './labels'
import { passwordProblems } from './passwordProblems'

const ids = { password: 'p', confirm: 'c' }
const confirmOf = (value: string, enabled = true) => ({
  enabled,
  blocking: enabled && value !== 'Correct-horse-9',
  message: value === '' ? labels.passwordConfirmMissing : labels.passwordMismatch,
})

describe('passwordProblems', () => {
  it('an empty password is one problem pointing at the password field', () => {
    const r = passwordProblems({
      labels,
      password: '',
      policy: FAKE_POLICY,
      confirm: confirmOf(''),
      ids,
    })
    expect(r.passwordError).toBe(labels.problemPasswordMissing)
    expect(r.problems[0]).toEqual({
      key: 'password',
      message: labels.problemPasswordMissing,
      target: 'p',
    })
  })

  it('a password that breaks the policy points at the password field (the checklist says which rule)', () => {
    const r = passwordProblems({
      labels,
      password: 'abc',
      policy: FAKE_POLICY,
      confirm: confirmOf('abc'),
      ids,
    })
    expect(r.passwordError).toBe(labels.problemPasswordRules)
  })

  it('a mismatch is its own problem pointing at the confirm field, after the password one', () => {
    const r = passwordProblems({
      labels,
      password: 'Correct-horse-9',
      policy: FAKE_POLICY,
      confirm: confirmOf('Correct-horse-8'),
      ids,
    })
    expect(r.passwordError).toBeUndefined()
    expect(r.problems).toEqual([{ key: 'confirm', message: labels.passwordMismatch, target: 'c' }])
  })

  it('with the confirmation switched off a mismatch is not a problem', () => {
    const r = passwordProblems({
      labels,
      password: 'Correct-horse-9',
      policy: FAKE_POLICY,
      confirm: confirmOf('x', false),
      ids,
    })
    expect(r.problems).toEqual([])
  })

  it('without a policy loaded only emptiness and the confirmation can block', () => {
    const r = passwordProblems({
      labels,
      password: 'abc',
      confirm: confirmOf('Correct-horse-9'),
      ids,
    })
    expect(r.passwordError).toBeUndefined()
  })
})
