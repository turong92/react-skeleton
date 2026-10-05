import { describe, expect, it } from 'vitest'
import { hasFilters, queryFromSearch, searchFromQuery } from './listParams'

describe('list params in the address bar', () => {
  it('reads page (1-based in the URL, 0-based for the server), search, status and pinned', () => {
    const query = queryFromSearch(new URLSearchParams('q= 회의 &status=ACTIVE&pinned=true&page=3'))
    expect(query).toEqual({ page: 2, size: 10, q: '회의', status: 'ACTIVE', pinned: true })
  })

  it('drops junk: unknown status, bad page, pinned other than true', () => {
    const query = queryFromSearch(new URLSearchParams('status=WHATEVER&page=-4&pinned=false'))
    expect(query).toEqual({ page: 0, size: 10, q: '', status: '', pinned: undefined })
  })

  it('writes only what differs from the defaults and round-trips', () => {
    expect(searchFromQuery({ page: 0, q: '', status: '' }).toString()).toBe('')
    const written = searchFromQuery({ page: 1, q: 'a b', status: 'DRAFT', pinned: true })
    expect(written.toString()).toBe('q=a+b&status=DRAFT&pinned=true&page=2')
    expect(queryFromSearch(written)).toMatchObject({
      page: 1,
      q: 'a b',
      status: 'DRAFT',
      pinned: true,
    })
  })

  it('knows when a filter is active (to tell an empty account from an empty result)', () => {
    expect(hasFilters({ page: 0 })).toBe(false)
    expect(hasFilters({ q: 'x' })).toBe(true)
    expect(hasFilters({ pinned: true })).toBe(true)
  })
})
