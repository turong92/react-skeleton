import { describe, expect, it } from 'vitest'
import { isOwn, lastOwnAuthorId, threadIsUnknown } from './authorship'
import { comment, thread } from './test/fixtures'

describe('isOwn', () => {
  it('trusts the server mine flag over any id comparison', () => {
    expect(isOwn({ mine: true, authorId: 'prf_x' }, 'acc_me')).toBe(true)
    expect(isOwn({ mine: false, authorId: 'acc_me' }, 'acc_me')).toBe(false)
  })

  it('falls back to authorId === currentUserId for a server that sends no mine', () => {
    expect(isOwn({ authorId: 'acc_me' }, 'acc_me')).toBe(true)
    expect(isOwn({ authorId: 'acc_other' }, 'acc_me')).toBe(false)
    expect(isOwn({ authorId: 'acc_me' }, undefined)).toBe(false)
  })
})

describe('lastOwnAuthorId', () => {
  it('is undefined when nothing in the thread is mine', () => {
    expect(lastOwnAuthorId([])).toBeUndefined()
    expect(lastOwnAuthorId([comment(1, null, { authorId: 'a' })])).toBeUndefined()
    // mine 이 없는 옛 서버 응답은 판정하지 않는다
  })

  it('picks the author id of the newest comment of mine, not the first', () => {
    const comments = [
      comment(1, null, { authorId: 'prf_a', mine: true, createdAt: '2026-01-01T00:00:00Z' }),
      comment(2, null, { authorId: 'prf_other', mine: false, createdAt: '2026-01-03T00:00:00Z' }),
      comment(3, null, { authorId: 'prf_b', mine: true, createdAt: '2026-01-02T00:00:00Z' }),
    ]
    expect(lastOwnAuthorId(comments)).toBe('prf_b')
  })

  it('walks replies under each top-level comment (a reply can be the latest)', () => {
    const roots = [
      thread(
        1,
        [comment(2, 1, { authorId: 'prf_b', mine: true, createdAt: '2026-01-05T00:00:00Z' })],
        {
          authorId: 'prf_a',
          mine: true,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ),
    ]
    expect(lastOwnAuthorId(roots)).toBe('prf_b')
  })

  it('breaks a same-instant tie by the larger id', () => {
    const at = '2026-01-01T00:00:00Z'
    expect(
      lastOwnAuthorId([
        comment(5, null, { authorId: 'prf_late', mine: true, createdAt: at }),
        comment(4, null, { authorId: 'prf_early', mine: true, createdAt: at }),
      ]),
    ).toBe('prf_late')
  })

  it('skips a deleted-author comment and a pending: id (legacy rows that no profile owns)', () => {
    const comments = [
      comment(1, null, { authorId: 'prf_a', mine: true, createdAt: '2026-01-01T00:00:00Z' }),
      comment(2, null, {
        authorId: 'deleted:x',
        authorDeleted: true,
        mine: true,
        createdAt: '2026-01-02T00:00:00Z',
      }),
      comment(3, null, { authorId: 'pending:c3', mine: true, createdAt: '2026-01-03T00:00:00Z' }),
    ]
    expect(lastOwnAuthorId(comments)).toBe('prf_a')
    expect(lastOwnAuthorId(comments.slice(1))).toBeUndefined()
  })

  it('compares instants, not strings (an offset timestamp is not later just because it sorts later)', () => {
    const comments = [
      // 10:00Z
      comment(1, null, { authorId: 'prf_a', mine: true, createdAt: '2026-01-01T10:00:00Z' }),
      // 09:30Z written with +09:00 — string-wise "…T18:30…" is larger, instant-wise it is earlier
      comment(2, null, { authorId: 'prf_b', mine: true, createdAt: '2026-01-01T18:30:00+09:00' }),
    ]
    expect(lastOwnAuthorId(comments)).toBe('prf_a')
  })
})

describe('lastOwnAuthorId — unparsable times', () => {
  it('a createdAt that does not parse never beats a real one, and does not throw the comparison off', () => {
    const comments = [
      comment(1, null, { authorId: 'prf_a', mine: true, createdAt: '2026-01-01T00:00:00Z' }),
      comment(2, null, { authorId: 'prf_bad', mine: true, createdAt: 'not a time' }),
    ]
    expect(lastOwnAuthorId(comments)).toBe('prf_a')
    expect(lastOwnAuthorId(comments.slice(1))).toBe('prf_bad') // 그래도 단서가 이것뿐이면 이것
  })
})

describe('threadIsUnknown', () => {
  const q = (over: Partial<Parameters<typeof threadIsUnknown>[0]>) => ({
    data: undefined as unknown,
    isPlaceholderData: false,
    isError: false,
    ...over,
  })

  it('is true while the current page has not arrived: still loading, or only the previous page kept as placeholder', () => {
    expect(threadIsUnknown(q({}))).toBe(true)
    expect(threadIsUnknown(q({ data: [], isPlaceholderData: true }))).toBe(true)
    expect(threadIsUnknown(q({ data: [] }))).toBe(false)
  })

  it('a first load that FAILED is not "not yet known" but "failed": the picker is not locked (the list has its own retry)', () => {
    expect(threadIsUnknown(q({ isError: true }))).toBe(false)
  })
})
