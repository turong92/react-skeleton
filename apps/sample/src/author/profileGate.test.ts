import { describe, expect, it } from 'vitest'
import { mustCreateProfileFirst } from './profileGate'

const profile = { id: 'prf_a', name: 'Ann', tag: '0001', createdAt: '2026-10-01T00:00:00Z' }

describe('mustCreateProfileFirst — writing needs a profile to write as', () => {
  it('asks to create one when the server requires an author and the account has no profile', () => {
    expect(mustCreateProfileFirst({ authorRequired: true, profiles: [] })).toBe(true)
  })

  it('lets the write through when there is a profile to pick', () => {
    expect(mustCreateProfileFirst({ authorRequired: true, profiles: [profile] })).toBe(false)
  })

  it('never blocks while the list is still unknown (loading or failed) — the picker itself guards the write', () => {
    expect(mustCreateProfileFirst({ authorRequired: true, profiles: undefined })).toBe(false)
  })

  it('never blocks a server that does not use author profiles', () => {
    expect(mustCreateProfileFirst({ authorRequired: false, profiles: [] })).toBe(false)
    expect(mustCreateProfileFirst({ authorRequired: undefined, profiles: [] })).toBe(false)
  })
})
