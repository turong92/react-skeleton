import { describe, expect, it } from 'vitest'
import { greetingOf, needsNickname, shownName } from './profileDisplay'

describe('shownName', () => {
  it('is the nickname, with the server tag when there is one', () => {
    expect(shownName({ displayName: '수민', displayTag: '4821' })).toBe('수민#4821')
    expect(shownName({ displayName: '수민', displayTag: null })).toBe('수민')
    expect(shownName({ displayName: '  수민 ' })).toBe('수민')
  })

  it('is null without a nickname — never the email or the account id', () => {
    expect(shownName({ displayName: null })).toBeNull()
    expect(shownName({ displayName: '   ', displayTag: '4821' })).toBeNull()
    expect(shownName(undefined)).toBeNull()
  })
})

describe('needsNickname', () => {
  it('asks only once the profile is known to have no nickname', () => {
    expect(needsNickname(undefined)).toBe(false) // 아직 모른다 — 깜빡이지 않는다
    expect(needsNickname({ displayName: null })).toBe(true)
    expect(needsNickname({ displayName: ' ' })).toBe(true)
    expect(needsNickname({ displayName: '수민' })).toBe(false)
  })
})

describe('greetingOf', () => {
  it('greets by nickname (without the tag), else neutrally — never by email or account id', () => {
    expect(greetingOf({ displayName: '수민', displayTag: '4821' })).toEqual({ name: '수민' })
    expect(greetingOf({ displayName: null })).toEqual({ name: null })
    expect(greetingOf(undefined)).toEqual({ name: null })
  })
})

describe('a profile that is not there (signed out in the middle of a refetch)', () => {
  it('has no name, needs no nickname prompt and greets neutrally', () => {
    expect(shownName(null)).toBeNull()
    expect(needsNickname(null)).toBe(false)
    expect(greetingOf(null)).toEqual({ name: null })
  })
})
