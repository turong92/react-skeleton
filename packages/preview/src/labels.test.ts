import { describe, expect, it } from 'vitest'
import { defaultPreviewLabels } from './labels.en'
import { koPreviewLabels } from './labels.ko'

describe('preview labels', () => {
  it('ko and en have the same keys', () =>
    expect(Object.keys(koPreviewLabels).sort()).toEqual(Object.keys(defaultPreviewLabels).sort()))

  it('every function label puts the number in', () => {
    for (const l of [defaultPreviewLabels, koPreviewLabels]) {
      expect(l.fit(42)).toContain('42')
      expect(l.actual(100)).toContain('100')
      expect(l.shrunk(37)).toContain('37')
      expect(l.percent(75)).toContain('75')
    }
  })

  it('names the four devices in both languages', () => {
    for (const l of [defaultPreviewLabels, koPreviewLabels])
      expect(Object.keys(l.devices).sort()).toEqual(
        ['pc', 'phone', 'tabletLandscape', 'tabletPortrait'].sort(),
      )
  })
})
