import { describe, expect, it } from 'vitest'
import { resolveInitialAuthor, switchNotice } from './initialAuthor'

const profiles = [
  { id: 'prf_a', name: 'Ann', tag: '0001', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'prf_b', name: 'Bea', tag: '0002', createdAt: '2026-01-02T00:00:00Z' },
]

describe('resolveInitialAuthor — three steps: this thread, then this device, then empty', () => {
  it('1. the profile already used in this thread wins over the device memory', () => {
    expect(resolveInitialAuthor({ profiles, threadAuthorId: 'prf_a', remembered: 'prf_b' })).toBe(
      'prf_a',
    )
  })

  it('2. no thread profile → what this device remembers for this board', () => {
    expect(resolveInitialAuthor({ profiles, threadAuthorId: undefined, remembered: 'prf_b' })).toBe(
      'prf_b',
    )
  })

  it('3. neither → empty: the writer has to choose (nothing is guessed, not even when there is one profile)', () => {
    expect(
      resolveInitialAuthor({ profiles, threadAuthorId: undefined, remembered: undefined }),
    ).toBeUndefined()
    expect(
      resolveInitialAuthor({
        profiles: profiles.slice(0, 1),
        threadAuthorId: undefined,
        remembered: undefined,
      }),
    ).toBeUndefined()
  })

  it('an id that is no longer one of my live profiles (deleted) is skipped, falling to the next step', () => {
    expect(
      resolveInitialAuthor({ profiles, threadAuthorId: 'prf_gone', remembered: 'prf_b' }),
    ).toBe('prf_b')
    expect(
      resolveInitialAuthor({ profiles, threadAuthorId: 'prf_gone', remembered: 'prf_gone2' }),
    ).toBeUndefined()
  })
})

describe('switchNotice — the one-line confirmation, only when leaving the profile used in this thread', () => {
  it('names the thread profile when switching to a different one', () => {
    expect(switchNotice({ profiles, threadAuthorId: 'prf_a', nextId: 'prf_b' })).toEqual(
      profiles[0],
    )
  })

  it('no confirmation for the same profile, for a thread nobody of mine wrote in, or for a thread profile that no longer exists', () => {
    expect(switchNotice({ profiles, threadAuthorId: 'prf_a', nextId: 'prf_a' })).toBeUndefined()
    expect(switchNotice({ profiles, threadAuthorId: undefined, nextId: 'prf_b' })).toBeUndefined()
    expect(switchNotice({ profiles, threadAuthorId: 'prf_gone', nextId: 'prf_b' })).toBeUndefined()
  })
})
