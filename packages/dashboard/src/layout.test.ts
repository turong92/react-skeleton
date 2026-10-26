import { describe, expect, it } from 'vitest'
import {
  availableCards,
  dropCard,
  layoutToSave,
  moveCard,
  orderedCards,
  parseLayout,
  toggleHidden,
} from './layout'

describe('layout', () => {
  it('lists the cards that exist in the default order (traffic, pages, geo, others, funnel, app)', () => {
    expect(availableCards(['app', 'geo', 'x', 'traffic'], true)).toEqual([
      'rankings.traffic',
      'rankings.geo',
      'rankings.x',
      'funnel',
      'app',
    ])
    expect(availableCards(['traffic'], false)).toEqual(['rankings.traffic'])
  })

  it('keeps the saved order, drops cards that are gone, puts new cards last', () => {
    expect(orderedCards(['a', 'b', 'c'], ['c', 'gone', 'a', 'c'])).toEqual(['c', 'a', 'b'])
  })

  it('moves by one and stops at the ends; a drop puts the card where the target was', () => {
    expect(moveCard(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveCard(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(dropCard(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(dropCard(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
  })

  it('toggles hidden keys and saves the fixed cards first', () => {
    expect(toggleHidden(['x'], 'y')).toEqual(['x', 'y'])
    expect(toggleHidden(['x', 'y'], 'x')).toEqual(['y'])
    expect(layoutToSave(['funnel'], ['x'])).toEqual({
      hidden: ['x'],
      order: ['tiles', 'chart', 'funnel'],
    })
  })

  it('reads a stored layout it cannot trust: anything but string lists becomes the default', () => {
    expect(parseLayout('{"hidden":["a",1],"order":"nope"}')).toEqual({ hidden: ['a'], order: [] })
    expect(parseLayout('not json')).toEqual({ hidden: [], order: [] })
    expect(parseLayout(null)).toEqual({ hidden: [], order: [] })
  })
})
