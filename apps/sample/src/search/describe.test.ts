import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { describeSearchType } from './describe'

const t = i18n.t.bind(i18n)

describe('describeSearchType - what the sample calls each kind of search result', () => {
  it('sends a note to /notes/:id and a product to /products/:code', () => {
    expect(describeSearchType(t, 'note').href('n1')).toBe('/notes/n1')
    expect(describeSearchType(t, 'product').href('pro')).toBe('/products/pro')
  })

  it('escapes the id in the path (a product code may hold characters a URL does not)', () => {
    expect(describeSearchType(t, 'note').href('a/b')).toBe('/notes/a%2Fb')
  })

  it('names the kinds in the current language', () => {
    expect(describeSearchType(t, 'note').label).toBe(t('search.type.note'))
    expect(describeSearchType(t, 'product').label).toBe(t('search.type.product'))
  })
})
