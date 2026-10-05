import { describe, expect, it } from 'vitest'
import { createRequestGuard, filterOptions, nextActiveIndex } from './comboboxLogic'

const options = [
  { value: 'seoul', label: 'Seoul' },
  { value: 'busan', label: 'Busan' },
  { value: 'sao', label: 'São Paulo' },
  { value: 'ko', label: '서울특별시' },
]

describe('filterOptions', () => {
  it('keeps options whose label contains the query, ignoring case and surrounding spaces', () => {
    expect(filterOptions(options, 'SEO').map((o) => o.value)).toEqual(['seoul'])
    expect(filterOptions(options, '  bus ').map((o) => o.value)).toEqual(['busan'])
  })
  it('an empty query keeps everything; a Korean query works on NFC/NFD alike', () => {
    expect(filterOptions(options, '')).toHaveLength(4)
    expect(filterOptions(options, '서울'.normalize('NFD')).map((o) => o.value)).toEqual(['ko'])
  })
  it('ignores accents (sao finds São)', () => {
    expect(filterOptions(options, 'sao').map((o) => o.value)).toContain('sao')
  })
})

describe('nextActiveIndex', () => {
  it('ArrowDown from nothing goes to the first, then wraps at the end', () => {
    expect(nextActiveIndex(-1, 3, 'ArrowDown')).toBe(0)
    expect(nextActiveIndex(2, 3, 'ArrowDown')).toBe(0)
  })
  it('ArrowUp from nothing goes to the last, then wraps at the start', () => {
    expect(nextActiveIndex(-1, 3, 'ArrowUp')).toBe(2)
    expect(nextActiveIndex(0, 3, 'ArrowUp')).toBe(2)
  })
  it('Home / End and an empty list', () => {
    expect(nextActiveIndex(1, 3, 'Home')).toBe(0)
    expect(nextActiveIndex(1, 3, 'End')).toBe(2)
    expect(nextActiveIndex(-1, 0, 'ArrowDown')).toBe(-1)
  })
  it('skips disabled options', () => {
    const disabled = new Set([1])
    expect(nextActiveIndex(0, 3, 'ArrowDown', disabled)).toBe(2)
    expect(nextActiveIndex(2, 3, 'ArrowUp', disabled)).toBe(0)
  })
})

describe('createRequestGuard', () => {
  it('only the latest request counts — an older answer arriving late is dropped', () => {
    const guard = createRequestGuard()
    const first = guard.next()
    const second = guard.next()
    expect(guard.isCurrent(first)).toBe(false)
    expect(guard.isCurrent(second)).toBe(true)
  })
  it('cancel() makes every in-flight request stale', () => {
    const guard = createRequestGuard()
    const id = guard.next()
    guard.cancel()
    expect(guard.isCurrent(id)).toBe(false)
  })
})
