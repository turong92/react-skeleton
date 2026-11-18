import { describe, expect, it } from 'vitest'
import { viewerSummary } from './viewerSummary'

describe('viewerSummary', () => {
  it('a fitted phone says phone', () =>
    expect(viewerSummary({ device: 'phone', fit: true, percent: 40 })).toEqual({
      device: 'phone',
      percent: null,
      extra: [],
    }))

  it('extra shows only while fit', () => {
    expect(viewerSummary({ device: 'pc', fit: true, percent: 50, extra: ['Open', 'Fan'] })).toEqual(
      { device: 'pc', percent: null, extra: ['Open', 'Fan'] },
    )
    expect(viewerSummary({ device: 'pc', fit: false, percent: 50, extra: ['Open'] })).toEqual({
      device: 'pc',
      percent: 50,
      extra: [],
    })
    expect(viewerSummary({ device: 'phone', fit: false, percent: 75 })).toEqual({
      device: null,
      percent: 75,
      extra: [],
    })
  })
})
