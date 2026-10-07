import { describe, expect, it } from 'vitest'
import { collidingNames, defaultAuthorLabels, nameKey, resolveAuthor } from './authorDisplay'

describe('resolveAuthor', () => {
  it('shows the nickname when there is one', () => {
    expect(resolveAuthor({ authorId: 'acc_317e', authorName: '수민' })).toEqual({
      kind: 'named',
      name: '수민',
      tag: null,
    })
  })

  it('falls back to the unnamed label, never to the account id', () => {
    for (const authorName of [null, undefined, '', '   ']) {
      const author = resolveAuthor({ authorId: 'acc_317e', authorName })
      expect(author).toEqual({
        kind: 'unnamed',
        name: defaultAuthorLabels.authorUnnamed,
        tag: null,
      })
      expect(author.name).not.toContain('acc_')
    }
  })

  it('treats authorDeleted and a deleted: id as a withdrawn user, even when a name is present', () => {
    expect(resolveAuthor({ authorId: 'acc_1', authorDeleted: true, authorName: '수민' })).toEqual({
      kind: 'deleted',
      name: defaultAuthorLabels.authorDeleted,
      tag: null,
    })
    expect(resolveAuthor({ authorId: 'deleted:9f2a' }).kind).toBe('deleted')
  })

  it('uses the labels it is given', () => {
    const labels = { authorDeleted: '탈퇴한 사용자', authorUnnamed: '이름 없는 사용자' }
    expect(resolveAuthor({ authorId: 'deleted:x' }, labels).name).toBe('탈퇴한 사용자')
    expect(resolveAuthor({ authorId: 'a' }, labels).name).toBe('이름 없는 사용자')
  })
})

describe('author tag', () => {
  it('carries the server tag only for named authors', () => {
    expect(resolveAuthor({ authorId: 'a', authorName: '수민', authorTag: '4821' }).tag).toBe('4821')
    expect(resolveAuthor({ authorId: 'a', authorName: null, authorTag: '4821' }).tag).toBeNull()
    expect(
      resolveAuthor({ authorId: 'deleted:a', authorName: '수민', authorTag: '4821' }).tag,
    ).toBeNull()
  })
})

describe('collidingNames', () => {
  it('collects names that two different accounts share, and ignores one account repeating itself', () => {
    const names = collidingNames([
      { authorId: 'a', authorName: '수민' },
      { authorId: 'b', authorName: '수민' },
      { authorId: 'c', authorName: '민수' },
      { authorId: 'c', authorName: '민수' },
      { authorId: 'deleted:x', authorDeleted: true },
      { authorId: 'deleted:y', authorDeleted: true },
    ])
    expect([...names]).toEqual(['수민'])
  })
})

describe('collisions fold the way the server folds names (case, full/half width, invisible marks)', () => {
  it('Sumin / sumin / ＳＵＭＩＮ / S\u200Bumin are one name', () => {
    expect(nameKey('Sumin')).toBe(nameKey('sumin'))
    expect(nameKey('ＳＵＭＩＮ')).toBe(nameKey('sumin'))
    expect(nameKey('S\u200Bumin')).toBe(nameKey('sumin'))
    expect(nameKey(' 수민 ')).toBe(nameKey('수민'))
  })

  it('two accounts whose names fold together collide, and the set holds the folded keys', () => {
    const names = collidingNames([
      { authorId: 'a', authorName: 'Sumin' },
      { authorId: 'b', authorName: 'sumin' },
      { authorId: 'c', authorName: '민수' },
    ])
    expect(names.has(nameKey('SUMIN'))).toBe(true)
    expect(names.has(nameKey('민수'))).toBe(false)
  })
})
