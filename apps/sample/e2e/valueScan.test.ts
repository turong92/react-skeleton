import { describe, expect, it } from 'vitest'
import { leafValues, sharedLeafValues } from './valueScan'

const allowed = new Set(['general', 'PUBLISHED', 'LIKE'])

describe('sharedLeafValues — values two responses have in common, whatever their keys are called', () => {
  it('positive control: finds the same value planted under different keys, deep inside arrays and objects', () => {
    const a = { id: 1, title: 'A', owner: { ref: 'secret-link' }, tags: [{ x: 'p' }] }
    const b = { id: 2, title: 'B', meta: [{ whoever: 'secret-link' }], tags: [{ y: 'q' }] }
    expect(sharedLeafValues([a], [b], allowed)).toEqual(['secret-link'])
  })

  it('finds a shared value in a different place of the two sets (list item vs detail objects)', () => {
    expect(
      sharedLeafValues([{ a: { b: ['acc_1'] } }, { c: 'x' }], [{ z: 'acc_1' }], allowed),
    ).toEqual(['acc_1'])
  })

  it('ignores null, booleans, numbers, empty strings and the allowed vocabulary (board code, status, reaction types)', () => {
    const a = {
      n: 3,
      ok: true,
      none: null,
      empty: '',
      code: 'general',
      status: 'PUBLISHED',
      r: 'LIKE',
    }
    const b = {
      n: 3,
      ok: true,
      none: null,
      empty: '',
      code: 'general',
      status: 'PUBLISHED',
      r: 'LIKE',
    }
    expect(sharedLeafValues([a], [b], allowed)).toEqual([])
  })

  it('finds nothing between disjoint responses', () => {
    expect(
      sharedLeafValues(
        [{ authorId: 'prf_a', authorName: 'A' }],
        [{ authorId: 'prf_b', authorName: 'B' }],
        allowed,
      ),
    ).toEqual([])
  })

  it('flattens every string leaf', () => {
    expect(leafValues({ a: ['x', { b: 'y' }], c: 1, d: null }).sort()).toEqual(['x', 'y'])
  })
})
