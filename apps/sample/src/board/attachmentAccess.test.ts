import { describe, expect, it } from 'vitest'
import { locate } from './attachmentAccess'

describe('locate', () => {
  it('finds a key by position, preferring the published list, then the waiting edit', () => {
    expect(locate(['a', 'b'], ['b', 'c'], 'b')).toEqual({ index: 1, from: 'current' })
    expect(locate(['a'], ['b', 'c'], 'c')).toEqual({ index: 1, from: 'edit' })
    expect(locate(['a'], undefined, 'z')).toBeUndefined()
  })
})
