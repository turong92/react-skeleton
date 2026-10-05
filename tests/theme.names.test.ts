import { THEMES } from '@skeleton/theme'
import tokensJson from '@skeleton/tokens/tokens.json'
import { describe, expect, it } from 'vitest'

describe('theme names', () => {
  it('THEMES is "system" plus the themes in packages/tokens/tokens.json', () => {
    const names = (tokensJson.$extensions.skeleton.themes as { name: string }[]).map((t) => t.name)
    expect([...THEMES].sort()).toEqual(['system', ...names].sort())
  })
})
