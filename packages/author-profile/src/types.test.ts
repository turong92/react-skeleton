import { describe, expect, it } from 'vitest'
import { profileDisplay } from './types'

describe('profileDisplay — name and tag may both be null (the server sends null for an unnamed legacy profile and when tags are off)', () => {
  it('name#tag when both are there', () => {
    expect(profileDisplay({ name: 'Ann', tag: '0001' })).toBe('Ann#0001')
  })

  it('no tag → no "#" at all', () => {
    expect(profileDisplay({ name: 'Ann', tag: null })).toBe('Ann')
  })

  it('no name → the unnamed word the app gave (never the literal "null")', () => {
    expect(profileDisplay({ name: null, tag: '0001' }, 'Unnamed')).toBe('Unnamed#0001')
    expect(profileDisplay({ name: null, tag: null }, 'Unnamed')).toBe('Unnamed')
    expect(profileDisplay({ name: null, tag: null })).not.toContain('null')
  })
})
