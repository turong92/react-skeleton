import { describe, expect, it } from 'vitest'
import { isSearchable } from './query'

describe('isSearchable (mirrors the server: pieces under 2 letters/digits are dropped)', () => {
  it.each([
    ['방끈', true],
    ['가방 끈', true],
    ['  ab  ', true],
    ['a b', false],
    ['가', false],
    ['', false],
    ['  ', false],
    ['"가"', false],
    ['+가 *방', false],
    ['가_방', false],
    ['１２', true], // 전각 숫자 - 서버가 NFKC 로 바꾼다
    ['😀😀', false],
    ['가 방끈', true],
  ])('%j → %s', (q, expected) => expect(isSearchable(q)).toBe(expected))
})
