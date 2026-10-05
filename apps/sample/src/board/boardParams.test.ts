import { describe, expect, it } from 'vitest'
import { BOARD_PAGE_SIZE, paramsFromSearch, searchFromParams } from './boardParams'

describe('board list params in the address bar', () => {
  it('reads sort, search and the page (1-based in the URL, 0-based for the server)', () => {
    expect(paramsFromSearch(new URLSearchParams('sort=reactions&q= 공지 &page=3'))).toEqual({
      page: 2,
      size: BOARD_PAGE_SIZE,
      sort: 'reactions',
      q: '공지',
    })
  })

  it('drops junk: an unknown sort falls back to latest, a bad page to the first', () => {
    expect(paramsFromSearch(new URLSearchParams('sort=oldest&page=-4'))).toEqual({
      page: 0,
      size: BOARD_PAGE_SIZE,
      sort: 'latest',
      q: '',
    })
  })

  it('writes only what differs from the defaults and round-trips', () => {
    expect(searchFromParams({ page: 0, sort: 'latest', q: '' }).toString()).toBe('')
    const written = searchFromParams({ page: 1, sort: 'comments', q: 'a b' })
    expect(written.toString()).toBe('sort=comments&q=a+b&page=2')
    expect(paramsFromSearch(written)).toMatchObject({ page: 1, sort: 'comments', q: 'a b' })
  })
})
