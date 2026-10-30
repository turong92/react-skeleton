import { describe, expect, it } from 'vitest'
import { clearFilters, hasFilters, setPage, toggleFlag, toggleRating, withSort } from './filters'

describe('review filters', () => {
  it('pressing the same star bar twice filters, then un-filters', () => {
    const on = toggleRating({ sort: 'recent' }, 4)
    expect(on.rating).toBe(4)
    expect(toggleRating(on, 4).rating).toBeUndefined()
    expect(toggleRating(on, 2).rating).toBe(2)
  })

  it('any change of the filter or the sort goes back to the first page; moving the page keeps the filter', () => {
    const base = { sort: 'recent' as const, rating: 3 as const, page: 4 }
    expect(toggleRating(base, 5).page).toBe(0)
    expect(toggleFlag(base, 'verified').page).toBe(0)
    expect(withSort(base, 'helpful')).toMatchObject({ sort: 'helpful', rating: 3, page: 0 })
    expect(setPage(base, 6)).toEqual({ ...base, page: 6 })
  })

  it('verified and photo switch on as true and off as absent (the server sees nothing for off)', () => {
    const on = toggleFlag({}, 'photo')
    expect(on.photo).toBe(true)
    expect('photo' in toggleFlag(on, 'photo')).toBe(false)
  })

  it('knows whether any filter is on (the sort alone is not a filter) and clears them but keeps the sort', () => {
    expect(hasFilters({ sort: 'helpful', page: 2 })).toBe(false)
    const filtered = { sort: 'helpful' as const, rating: 2 as const, verified: true, page: 2 }
    expect(hasFilters(filtered)).toBe(true)
    expect(clearFilters(filtered)).toEqual({ sort: 'helpful', page: 0 })
  })
})
