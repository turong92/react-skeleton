import { describe, expect, it } from 'vitest'
import { DISPLAY_NAME_MAX_LENGTH, displayNameProblem, resolveDisplayNameMode } from './displayName'
import { defaultAuthLabels as L } from './labels'

describe('resolveDisplayNameMode', () => {
  it('keeps the old askDisplayName boolean working and lets the new prop win', () => {
    expect(resolveDisplayNameMode(undefined, undefined)).toBe('off')
    expect(resolveDisplayNameMode(undefined, true)).toBe('optional')
    expect(resolveDisplayNameMode('required', false)).toBe('required')
    expect(resolveDisplayNameMode('off', true)).toBe('off')
  })
})

describe('displayNameProblem', () => {
  it('only a required nickname can be missing, and blanks count as missing', () => {
    expect(displayNameProblem('', 'required', L)).toBe(L.problemDisplayNameMissing)
    expect(displayNameProblem('   ', 'required', L)).toBe(L.problemDisplayNameMissing)
    expect(displayNameProblem('', 'optional', L)).toBeUndefined()
    expect(displayNameProblem('', 'off', L)).toBeUndefined()
  })

  it('allows 1..60 characters after trimming', () => {
    expect(displayNameProblem(`  ${'a'.repeat(60)}  `, 'optional', L)).toBeUndefined()
    expect(displayNameProblem('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1), 'optional', L)).toBe(
      L.problemDisplayNameTooLong(DISPLAY_NAME_MAX_LENGTH),
    )
  })
})
