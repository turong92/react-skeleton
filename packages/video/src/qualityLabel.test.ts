import { describe, expect, it } from 'vitest'
import { defaultVideoPlayerLabels, koVideoPlayerLabels } from './labels'
import { heightOfSize, qualityLabel } from './qualityLabel'

const en = defaultVideoPlayerLabels

describe('heightOfSize', () => {
  it('names a quality by the shorter side, so a vertical 1080x1920 video is 1080p too', () => {
    expect(heightOfSize(1920, 1080)).toBe(1080)
    expect(heightOfSize(1080, 1920)).toBe(1080)
    expect(heightOfSize(3840, 2160)).toBe(2160)
  })

  it('does not know the height of a size that is not known', () => {
    expect(heightOfSize(0, 0)).toBeNull()
    expect(heightOfSize(NaN, 100)).toBeNull()
  })
})

describe('qualityLabel', () => {
  it('names a step by its real height', () => {
    expect(qualityLabel(en, 'orig', 1080, null)).toBe('1080p')
    expect(qualityLabel(en, 'orig', 2160, null)).toBe('2160p')
    expect(qualityLabel(en, 'compat', 720, null)).toBe('720p')
  })

  it('falls back to the old words when the height is not known', () => {
    expect(qualityLabel(en, 'orig', null, null)).toBe('Original')
    expect(qualityLabel(koVideoPlayerLabels, 'orig', null, null)).toBe('원본')
    expect(qualityLabel(en, 'compat', null, null)).toBe('720p')
  })

  it('shows what auto is playing right now', () => {
    expect(qualityLabel(en, 'auto', null, 1080)).toBe('Auto (1080p)')
    expect(qualityLabel(koVideoPlayerLabels, 'auto', null, 720)).toBe('자동 (720p)')
    expect(qualityLabel(en, 'auto', null, null)).toBe('Auto')
  })
})
