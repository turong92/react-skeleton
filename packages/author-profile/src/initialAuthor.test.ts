import { describe, expect, it } from 'vitest'
import { resolveInitialAuthor, switchNotice, threadOverridesAuto } from './initialAuthor'

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

describe('resolveInitialAuthor — while the thread is still loading', () => {
  it('does not settle: an unknown thread is not "never wrote here", so the device memory must not fill in', () => {
    expect(
      resolveInitialAuthor({
        profiles,
        threadAuthorId: undefined,
        remembered: 'prf_b',
        threadLoading: true,
      }),
    ).toBeUndefined()
    expect(
      resolveInitialAuthor({
        profiles,
        threadAuthorId: 'prf_a',
        remembered: 'prf_b',
        threadLoading: true,
      }),
    ).toBeUndefined()
  })

  it('once loaded it follows the three steps again', () => {
    expect(
      resolveInitialAuthor({
        profiles,
        threadAuthorId: undefined,
        remembered: 'prf_b',
        threadLoading: false,
      }),
    ).toBe('prf_b')
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

describe('threadOverridesAuto — a value the picker filled in by itself gives way to what the thread says; a value a person chose never does', () => {
  const base = { profiles, value: 'prf_b', autoValue: 'prf_b', threadLoading: false }

  it('auto value + the thread now names another live profile of mine → that profile', () => {
    expect(threadOverridesAuto({ ...base, threadAuthorId: 'prf_a' })).toBe('prf_a')
  })

  it('a value the person chose (not the auto one) is left alone', () => {
    expect(
      threadOverridesAuto({ ...base, autoValue: undefined, threadAuthorId: 'prf_a' }),
    ).toBeUndefined()
    expect(
      threadOverridesAuto({ ...base, autoValue: 'prf_a', threadAuthorId: 'prf_a' }),
    ).toBeUndefined()
  })

  it('nothing to do while the thread is loading, when it names nobody, the same profile, or a profile that is gone', () => {
    expect(
      threadOverridesAuto({ ...base, threadLoading: true, threadAuthorId: 'prf_a' }),
    ).toBeUndefined()
    expect(threadOverridesAuto({ ...base, threadAuthorId: undefined })).toBeUndefined()
    expect(threadOverridesAuto({ ...base, threadAuthorId: 'prf_b' })).toBeUndefined()
    expect(threadOverridesAuto({ ...base, threadAuthorId: 'prf_gone' })).toBeUndefined()
  })
})
