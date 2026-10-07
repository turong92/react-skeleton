import { describe, expect, it } from 'vitest'
import { mustCreateProfileFirst } from './profileGate'

const named = { id: 'prf_a', name: 'Ann', tag: '0001', createdAt: '2026-10-01T00:00:00Z' }
const unnamed = { id: 'prf_u', name: null, tag: null, createdAt: '2026-10-01T00:00:00Z' }

describe('mustCreateProfileFirst — writing needs a named profile to write as', () => {
  it('asks when the server requires an author and the account has no profile at all', () => {
    expect(mustCreateProfileFirst({ authorRequired: true, profiles: [] })).toBe(true)
  })

  it('asks when every profile is unnamed — the automatic first profile of an account without a nickname', () => {
    expect(mustCreateProfileFirst({ authorRequired: true, profiles: [unnamed] })).toBe(true)
    expect(
      mustCreateProfileFirst({ authorRequired: true, profiles: [{ ...unnamed, name: '  ' }] }),
    ).toBe(true)
  })

  it('lets the write through as soon as one profile has a name (the unnamed one may stay)', () => {
    expect(mustCreateProfileFirst({ authorRequired: true, profiles: [named] })).toBe(false)
    expect(mustCreateProfileFirst({ authorRequired: true, profiles: [unnamed, named] })).toBe(false)
  })

  it('never blocks while the list is still unknown (loading or failed) — the picker itself guards the write', () => {
    expect(mustCreateProfileFirst({ authorRequired: true, profiles: undefined })).toBe(false)
  })

  it('never blocks a server that does not use author profiles', () => {
    expect(mustCreateProfileFirst({ authorRequired: false, profiles: [] })).toBe(false)
    expect(mustCreateProfileFirst({ authorRequired: undefined, profiles: [unnamed] })).toBe(false)
  })
})
