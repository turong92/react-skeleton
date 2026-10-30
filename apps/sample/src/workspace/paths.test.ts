import { describe, expect, it } from 'vitest'
import { slugFromPath, swapSlug, teamPath } from './paths'

describe('workspace paths', () => {
  it('builds a team address and reads the slug back from it', () => {
    expect(teamPath('example-team')).toBe('/w/example-team/notes')
    expect(teamPath('example-team', 'settings')).toBe('/w/example-team/settings')
    expect(slugFromPath('/w/example-team/notes/n1')).toBe('example-team')
    expect(slugFromPath('/notes')).toBeUndefined()
  })

  it('swaps only the slug and keeps the rest of the address, search and hash', () => {
    expect(swapSlug({ pathname: '/w/old/notes/n1', search: '?q=a', hash: '#x' }, 'new')).toBe(
      '/w/new/notes/n1?q=a#x',
    )
    expect(swapSlug({ pathname: '/w/old', search: '', hash: '' }, 'new')).toBe('/w/new')
  })
})
