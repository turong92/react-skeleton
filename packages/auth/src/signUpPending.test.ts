import { describe, expect, it } from 'vitest'
import { createSignUpPending } from './signUpPending'

const memory = () => {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

describe('the sign-up attempt survives a reload of the code step (FINAL-3 draft)', () => {
  it('remembers the attempt in the tab storage and reads it back', () => {
    const storage = memory()
    createSignUpPending({ storage }).save({ email: 'a@b.c', signUpId: 'sid' })
    expect(createSignUpPending({ storage }).read()).toEqual({ email: 'a@b.c', signUpId: 'sid' })
  })

  it('forgets it after the code lifetime (10 min) — an expired code step must not come back', () => {
    const storage = memory()
    let now = 1_000
    const pending = createSignUpPending({ storage, now: () => now })
    pending.save({ email: 'a@b.c', signUpId: 'sid' })
    now += 11 * 60_000
    expect(pending.read()).toBeNull()
  })

  it('never stores the password (only the address and the opaque attempt id)', () => {
    const storage = memory()
    createSignUpPending({ storage }).save({ email: 'a@b.c', signUpId: 'sid' })
    expect([...storage.map.values()].join('')).not.toMatch(/password/i)
  })

  it('clear() removes it; garbage and a throwing storage read as nothing', () => {
    const storage = memory()
    const pending = createSignUpPending({ storage })
    pending.save({ email: 'a@b.c', signUpId: 'sid' })
    pending.clear()
    expect(pending.read()).toBeNull()
    storage.map.set('skeleton.signUp', '{nope')
    expect(pending.read()).toBeNull()
    const throwing = createSignUpPending({
      storage: {
        getItem: () => {
          throw new Error('denied')
        },
        setItem: () => {
          throw new Error('denied')
        },
        removeItem: () => {
          throw new Error('denied')
        },
      },
    })
    expect(() => throwing.save({ email: 'a@b.c', signUpId: 's' })).not.toThrow()
    expect(throwing.read()).toEqual({ email: 'a@b.c', signUpId: 's' }) // memory fallback
  })
})
