import { describe, expect, it } from 'vitest'
import { searchPath } from './searchQuery'

describe('searchPath - the address the header box sends a search to', () => {
  it('puts the text in ?q= encoded', () => {
    expect(searchPath('가방끈')).toBe('/search?q=%EA%B0%80%EB%B0%A9%EB%81%88')
    expect(searchPath('a&b=c')).toBe('/search?q=a%26b%3Dc')
  })
})
