import { describe, expect, it } from 'vitest'
import { splitHighlights } from './splitHighlights'

const plain = (parts: ReturnType<typeof splitHighlights>) =>
  parts.map((p) => (p.mark ? `[${p.text}]` : p.text)).join('')

describe('splitHighlights', () => {
  it('cuts the text at [start, end) and marks only the matched parts', () => {
    expect(plain(splitHighlights('여름 가방끈 수선', [[4, 6]]))).toBe('여름 가[방끈] 수선')
  })

  it('returns the whole text unmarked when there is nothing to mark', () => {
    expect(splitHighlights('abc', [])).toEqual([{ text: 'abc', mark: false }])
  })

  it('counts positions in UTF-16 units, so an emoji before the match shifts by two', () => {
    // 😀 = 2 units: "😀 방끈" → 방끈 starts at 3
    expect(plain(splitHighlights('😀 방끈', [[3, 5]]))).toBe('😀 [방끈]')
  })

  it('keeps a surrogate pair whole when a range edge falls inside it', () => {
    const parts = splitHighlights('a😀b', [[2, 3]])
    expect(plain(parts)).toBe('a[😀]b')
    expect(parts.map((p) => p.text).join('')).toBe('a😀b')
  })

  it('keeps a combining mark with its base (the server counts it at the end of the match)', () => {
    const text = 'école' // é as e + U+0301
    expect(plain(splitHighlights(text, [[0, 2]]))).toBe('[é]cole')
  })

  it('pulls a combining mark into the range that ends right before it', () => {
    expect(plain(splitHighlights('e\u0301cole', [[0, 1]]))).toBe('[e\u0301]cole')
  })

  it('merges overlapping and touching ranges and ignores unordered input', () => {
    expect(
      plain(
        splitHighlights('abcdefgh', [
          [4, 6],
          [0, 2],
          [1, 3],
          [3, 4],
        ]),
      ),
    ).toBe('[abcdef]gh')
  })

  it('drops empty, reversed, negative and out-of-range ranges and clamps the rest', () => {
    expect(
      plain(
        splitHighlights('abc', [
          [2, 2],
          [3, 1],
          [-5, -1],
          [10, 12],
        ]),
      ),
    ).toBe('abc')
    expect(plain(splitHighlights('abc', [[1, 99]]))).toBe('a[bc]')
  })
})
