import type { VideoItem } from '../types'

export function fakeItem(overrides: Partial<VideoItem> = {}): VideoItem {
  return {
    id: 'v1',
    purpose: 'clip',
    visibility: 'PRIVATE',
    status: 'PLAYABLE',
    bytes: 1000,
    compat: 'READY',
    ladder: 'READY',
    progress: null,
    failCode: null,
    width: 1080,
    height: 1920,
    durationMs: 42_000,
    createdAt: '2026-11-04T00:00:00Z',
    ...overrides,
  }
}
